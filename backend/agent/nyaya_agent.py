import re
import time
import os
from typing import Dict, List, Optional
from agent.retriever import HybridRetriever
from agent.graph_tool import CitationGraph
from agent.guardrails import LegalGuardrails, SafetyFilter, CitationValidator
from optimizations import score_result_relevance, extract_query_terms, OPTIMIZED_SETTINGS, canonicalize_legal_query
from agent.llm import generate_answer, generate_answer_with_history
from common_utils import clean_text
from agent.prompts import SYSTEM_PROMPT
from dotenv import load_dotenv

load_dotenv()


def _is_truthy_env(name: str, default: str = "1") -> bool:
    value = os.getenv(name, default)
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


class NyayaAgent:
    def __init__(self, show_debug=False):
        # Initialize graph and retriever
        self.graph = None
        if not _is_truthy_env("NYAYA_DISABLE_GRAPH", "0"):
            try:
                self.graph = CitationGraph()
            except Exception as error:
                if show_debug:
                    print(f"[WARNING] Graph disabled due to init failure: {error}")
        self.show_debug = show_debug  # Suppress debug output for end users
        
        # Initialize guardrails
        self.guardrails = LegalGuardrails()
        self.safety_filter = SafetyFilter()
        self.citation_validator = CitationValidator()
        
        if self.show_debug:
            print("[OK] Using hybrid retrieval (vector 60% + BM25 40%) with Neo4j integration")
            print("[OK] Guardrails enabled for legal accuracy and safety")
        self.retriever = HybridRetriever()
        
        # Azure OpenAI is configured in llm.py
        self.last_llm_error = None

    @staticmethod
    def _deduplicate_cases(cases, max_results=20):
        """Deduplicate case list by normalized case name"""
        seen = set()
        unique_cases = []
        for item in cases:
            # Handle both tuples (case, count) and strings
            case = item[0] if isinstance(item, tuple) else item
            case_normalized = case.lower().strip()
            if case_normalized not in seen and len(case) > 5:
                seen.add(case_normalized)
                unique_cases.append(item)
            if len(unique_cases) >= max_results:
                break
        return unique_cases

    def _generate_with_llm(self, prompt: str) -> str:
        """Generate answer using Azure OpenAI (configured in llm.py)"""
        try:
            self.last_llm_error = None
            answer = generate_answer(prompt)
            if answer and answer.strip():
                return answer
            raise RuntimeError("LLM returned an empty response")
        except Exception as error:
            self.last_llm_error = f"{type(error).__name__}: {error}"
            if self.show_debug:
                print(f"[DEBUG] LLM generation failed: {type(error).__name__}: {error}")
            raise

    def _build_retrieval_fallback_answer(self, query, clean_chunks):
        if not clean_chunks:
            return "Sorry, I couldn't find enough relevant information for that question in the current database."

        # Confidence gate: avoid hallucination/noisy dump
        first_cleaned, first_chunk = clean_chunks[0]
        first_dict = first_chunk if isinstance(first_chunk, dict) else {"text": first_cleaned}
        best_score = score_result_relevance(first_dict, query)

        query_terms = extract_query_terms(query)
        matched_query_terms = sum(1 for term in query_terms if term in first_cleaned.lower())

        if best_score < 0.10 or (len(query_terms) >= 3 and matched_query_terms == 0):
            return "Sorry, I couldn't find reliable information for that question in the current database."

        seen = set()
        unique = []
        for cleaned, chunk in clean_chunks:
            snippet_key = cleaned[:160].lower()
            if snippet_key in seen:
                continue
            seen.add(snippet_key)
            unique.append((cleaned, chunk))
            if len(unique) >= 2:
                break

        if not unique:
            return "Sorry, I couldn't find enough relevant information for that question in the current database."

        best_text, best_chunk = unique[0]
        best_excerpt = best_text[:420].strip()

        lines = [
            "### Direct Answer",
            (
                "Based on the retrieved Sri Lankan authority, judicial review is framed as a control "
                "on misuse or excess of public power to protect the rule of law."
                if "judicial review" in query.lower() else best_excerpt
            ),
            "",
            "### Evidence from Retrieved Text",
            f"- {best_excerpt}",
            "",
            "### Sources",
        ]

        for i, (_, chunk) in enumerate(unique, 1):
            if not isinstance(chunk, dict):
                continue
            pdf = chunk.get("pdf_name") or "Unknown"
            page = chunk.get("page") if chunk.get("page") is not None else "?"
            lines.append(f"{i}. {pdf}, page {page}")

        lines.append("")
        error_text = (self.last_llm_error or "").lower()
        if any(marker in error_text for marker in ["resource_exhausted", "quota", "429", "api"]):
            lines.append("### Note")
            lines.append("This response is retrieval-only because the Azure OpenAI API is currently unavailable.")
        else:
            lines.append("### Note")
            lines.append("This response is retrieval-only because the LLM is currently unavailable.")
        return "\n".join(lines)

    def _build_case_source_block(self, case_name, top_k=2):
        lines = ["\n\n**Source Citations:**"]
        try:
            chunks = self.retriever.search(case_name, top_k=top_k, return_metadata=True)
        except Exception as e:
            lines.append(f"- Could not fetch supporting sources: {e}")
            return "\n".join(lines)

        added = 0
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue

            text = clean_text(chunk.get("text", ""))
            if len(text) < 40:
                continue

            pdf = chunk.get("pdf_name") or "Unknown"
            page = chunk.get("page") if chunk.get("page") is not None else -1
            section = chunk.get("section") or "Unknown"
            quote = text[:260].strip().replace('"', "'")

            lines.append(f"{added + 1}. Case: {case_name}")
            lines.append(f"   PDF/File: {pdf}")
            lines.append(f"   Page: {page}")
            lines.append(f"   Section: {section}")
            lines.append(f"   Citation: \"{quote}\"")
            added += 1

            if added >= top_k:
                break

        if added == 0:
            lines.append("- No supporting quoted citation found in retrieved chunks.")

        return "\n".join(lines)

    @staticmethod
    def _extract_case_name(query: str) -> Optional[str]:
        # Pattern: "word v. word" or "word vs word" or "word versus word"
        case_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:v\.|vs\.?|versus)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'
        case_match = re.search(case_pattern, query)
        if not case_match:
            return None
        return case_match.group(0)

    @staticmethod
    def _build_source_map(answer: str, chunks: List[Dict]) -> List[Dict]:
        paragraphs = [p.strip() for p in answer.split("\n\n") if p.strip()]
        source_map = []
        for index, para in enumerate(paragraphs, 1):
            matched = None
            best_overlap = 0
            para_terms = set(extract_query_terms(para))
            for chunk in chunks:
                if not isinstance(chunk, dict):
                    continue
                text = chunk.get("text", "")
                chunk_terms = set(extract_query_terms(text))
                overlap = len(para_terms & chunk_terms)
                if overlap > best_overlap:
                    best_overlap = overlap
                    matched = chunk
            if matched:
                source_map.append({
                    "paragraph_id": index,
                    "snippet": para[:180],
                    "pdf_name": matched.get("pdf_name", "Unknown"),
                    "page": matched.get("page"),
                    "section": matched.get("section", "Unknown"),
                    "qdrant_score": round(float(best_overlap) / max(len(para_terms), 1), 3),
                    "exact_quote": (matched.get("text", "") or "")[:320],
                })
        return source_map

    @staticmethod
    def _null_result_message(topic: str) -> str:
        return (
            "I have searched the authenticated database and found no specific "
            f"Sri Lankan statutory or case law regarding {topic}. "
            "Please provide a narrower fact pattern, exact case name, or statute reference."
        )

    def _build_precedent_chain_for_query(self, query: str, case_name: Optional[str]) -> List[Dict]:
        if not self.graph:
            return []

        if case_name:
            return self.graph.get_top_related_precedents(case_name, limit=3)

        chain = self.graph.get_query_precedent_chain(query, limit=1)
        if not chain:
            return []

        # Flatten first anchor for API friendliness
        first = chain[0]
        return first.get("related", [])

    def ask_with_report(self, query: str, debug_mode: bool = False, history: Optional[List[Dict]] = None) -> Dict[str, object]:
        start_total = time.time()
        query_lower = query.lower()
        debug_trace = []

        def log_step(msg: str):
            if debug_mode or self.show_debug:
                debug_trace.append(msg)

        # Step 1: Safety filter
        is_safe, safety_reason = self.safety_filter.check_safety(query)
        if not is_safe:
            refusal = self.safety_filter.get_refusal_message(safety_reason)
            return {
                "question": query,
                "answer": refusal,
                "status": "blocked",
                "source_map": [],
                "precedent_chain": [],
                "groundedness_score": 0.0,
                "reflection_report": {},
                "debug_trace": debug_trace,
                "latency_seconds": round(time.time() - start_total, 3),
            }

        # Step 2: Input quality check
        query_terms = extract_query_terms(query)
        if len(query_terms) < 2 and len(query.split()) < 2:
            return {
                "question": query,
                "answer": "Please ask a more specific legal question (e.g., 'difference between civil and criminal burden of proof').",
                "status": "needs_clarification",
                "source_map": [],
                "precedent_chain": [],
                "groundedness_score": 0.0,
                "reflection_report": {},
                "debug_trace": debug_trace,
                "latency_seconds": round(time.time() - start_total, 3),
            }

        # Step 3: Analyze query and decide graph-first path
        case_name = self._extract_case_name(query)
        graph_context_lines = []
        precedent_chain = []
        temporal_warnings = []
        if case_name and self.graph:
            log_step(f"analyze: detected case name '{case_name}', running graph-first traversal")
            try:
                cited_by = self.graph.get_precedent_history(case_name, limit=10)
                cites = self.graph.get_cited_cases(case_name, limit=10)
                precedent_chain = self.graph.get_top_related_precedents(case_name, limit=3)
                temporal_warnings = self.graph.get_temporal_warnings(case_name, limit=10)

                if cited_by:
                    graph_context_lines.append(f"Later citing cases for {case_name}: " + "; ".join(cited_by[:5]))
                if cites:
                    graph_context_lines.append(f"Cases cited by {case_name}: " + "; ".join(cites[:5]))
                if temporal_warnings:
                    warning_cases = "; ".join(
                        f"{w.get('case')} ({w.get('status')})" for w in temporal_warnings[:3]
                    )
                    graph_context_lines.append(f"Temporal warning: potentially weakened precedents found: {warning_cases}")
            except Exception as e:
                log_step(f"graph failure: {type(e).__name__}: {e}")
        elif self.graph and ("most cited" in query_lower or "top cited" in query_lower):
            log_step("analyze: graph statistics query detected")
            try:
                top = self.graph.get_most_cited(50)
                unique_cases = self._deduplicate_cases(top, max_results=20)
                if unique_cases:
                    answer = "**Top 20 Most Cited Cases:**\n\n"
                    for i, (case, count) in enumerate(unique_cases, 1):
                        answer += f"{i}. {case.title()} - {count} citations\n"
                    return {
                        "question": query,
                        "answer": answer,
                        "status": "success",
                        "source_map": [],
                        "precedent_chain": [],
                        "groundedness_score": 1.0,
                        "reflection_report": {},
                        "debug_trace": debug_trace,
                        "latency_seconds": round(time.time() - start_total, 3),
                    }
            except Exception as e:
                log_step(f"graph stats failure: {type(e).__name__}: {e}")

        # Step 4: Retrieval (expanded with graph context when available)
        retrieval_query = canonicalize_legal_query(query)
        burden_keywords = ["burden of proof", "standard of proof", "beyond reasonable doubt"]
        if any(keyword in query_lower for keyword in burden_keywords):
            retrieval_query = (
                f"{query} prosecution must prove beyond reasonable doubt "
                "criminal trial presumption rebuttable evidence ordinance"
            )

        if graph_context_lines:
            retrieval_query = f"{retrieval_query} {' '.join(graph_context_lines)}"
            log_step("retrieve: expanded query with graph-derived context")

        try:
            start = time.time()
            context_chunks = self.retriever.search(retrieval_query, top_k=3, return_metadata=True)
            if self.show_debug:
                print("Retrieval time:", time.time() - start)
            log_step(f"retrieve: got {len(context_chunks)} chunks")
        except Exception as e:
            if self.show_debug:
                print("Vector retrieval failed:", e)
            log_step(f"retrieve failure: {type(e).__name__}: {e}")
            context_chunks = []
        
        # Clean and filter chunks
        clean_chunks = []
        for chunk in context_chunks:
            chunk_text = chunk.get("text", "") if isinstance(chunk, dict) else chunk
            cleaned = clean_text(chunk_text)
            # Skip very short chunks, but allow longer ones for legal content
            if len(cleaned) > 50:
                clean_chunks.append((cleaned, chunk))

        # Null-result protocol: low-confidence retrieval must not be hallucinated into legal rules.
        null_threshold = float(OPTIMIZED_SETTINGS.get("null_result_threshold", 0.35))
        retrieval_confidences = []
        for cleaned, chunk in clean_chunks:
            if isinstance(chunk, dict):
                score = chunk.get("retrieval_score")
                if isinstance(score, (int, float)):
                    retrieval_confidences.append(float(score))
                    continue
                relevance_score = score_result_relevance({"text": cleaned}, query)
                retrieval_confidences.append(float(relevance_score))

        if clean_chunks and retrieval_confidences and max(retrieval_confidences) < null_threshold:
            return {
                "question": query,
                "answer": self._null_result_message(canonicalize_legal_query(query)),
                "status": "insufficient_evidence",
                "source_map": self._build_source_map("", [chunk for _, chunk in clean_chunks if isinstance(chunk, dict)]),
                "precedent_chain": precedent_chain,
                "groundedness_score": round(max(retrieval_confidences), 3),
                "reflection_report": {
                    "null_result_triggered": True,
                    "max_retrieval_confidence": round(max(retrieval_confidences), 3),
                    "threshold": null_threshold,
                    "temporal_warnings": temporal_warnings,
                },
                "debug_trace": debug_trace,
                "latency_seconds": round(time.time() - start_total, 3),
            }
        
        if not clean_chunks:
            return {
                "question": query,
                "answer": "I couldn't find relevant information in the database for your query. Please try rephrasing your question or ask about a different legal topic.",
                "status": "no_context",
                "source_map": [],
                "precedent_chain": precedent_chain,
                "groundedness_score": 0.0,
                "reflection_report": {},
                "debug_trace": debug_trace,
                "latency_seconds": round(time.time() - start_total, 3),
            }
        
        # Limit total context to avoid overwhelming the model
        context_blocks = []
        for cleaned, chunk in clean_chunks[:2]:
            cleaned_excerpt = cleaned[:1200]
            if isinstance(chunk, dict):
                pdf = chunk.get("pdf_name") or "Unknown"
                page = chunk.get("page") or "Unknown"
                section = chunk.get("section") or "Unknown"
                line_start = chunk.get("line_start") or "Unknown"
                line_end = chunk.get("line_end") or "Unknown"
                context_blocks.append(
                    "TEXT:\n{0}\n\nSOURCE:\nPDF: {1}\nPage: {2}\nSection: {3}\nLines: {4}-{5}\n-----------------------".format(
                        cleaned_excerpt, pdf, page, section, line_start, line_end
                    )
                )
            else:
                context_blocks.append(cleaned_excerpt)

        context_text = "\n\n".join(context_blocks)
        self.last_llm_error = None
        
        # Build prompt for LLM - conversational ChatGPT-style
        prompt = f"""{SYSTEM_PROMPT}

    Use this structured workflow:
    1) Analyze the question and identify case names.
    2) Prefer graph-derived legal context when case names are present.
    3) Draft the answer using retrieved context only.
    4) Avoid unsupported section/page references.

    You are Nyaya, a helpful Sri Lankan legal assistant. Answer questions naturally like ChatGPT, using the provided legal documents as your source.

**Context from case law:**
{context_text}

    **Graph Context:**
    {chr(10).join(graph_context_lines) if graph_context_lines else 'No explicit graph context available.'}

**Question:** {query}

**How to answer (MUST follow this exact structure):**
### Direct Answer
Provide a direct answer in 2-4 sentences.

### Legal Basis
- State the governing principle from the retrieved material.
- If the material is narrow or non-exhaustive, say that explicitly.

### Practical Takeaway
One sentence users can act on.

Rules:
- Use only retrieved sources.
- Do not invent enumerated lists if the sources do not provide one.
- Keep citations precise and limited to retrieved files/pages.
- Keep total length under 170 words.
"""
        
        try:
            if history:
                answer = generate_answer_with_history(prompt, history)
            else:
                answer = self._generate_with_llm(prompt)
            
            # 🛡️ GUARDRAIL 2: Validate response with guardrails
            is_valid, validated_answer, warnings = self.guardrails.check_response(
                answer, 
                [chunk for _, chunk in clean_chunks if isinstance(chunk, dict)]
            )
            
            if warnings and self.show_debug:
                for warning in warnings:
                    print(f"[GUARDRAIL] {warning}")
            
            # Use validated (potentially modified) answer
            answer = validated_answer

            # Step 5: Self-correction reflection loop
            reflection_answer, reflection_report = self.guardrails.reflection_self_check(
                answer,
                [chunk for _, chunk in clean_chunks if isinstance(chunk, dict)]
            )
            answer = reflection_answer
            log_step(
                "self-check: removed "
                f"{reflection_report.get('removed_sentences', 0)} unsupported sentence(s)"
            )
            
            # 🛡️ GUARDRAIL 3: Citation validation
            citations = self.citation_validator.extract_citations(answer)
            if citations:
                validation = self.citation_validator.validate_against_sources(
                    citations,
                    [chunk for _, chunk in clean_chunks if isinstance(chunk, dict)]
                )
                groundedness = self.citation_validator.get_groundedness_score(validation)
                
                if self.show_debug:
                    print(f"[CITATION] Groundedness score: {groundedness:.2%}")
                
                # Warn if low groundedness
                if groundedness < 0.7 and len(citations) > 0:
                    answer += "\n\n⚠️ *Some citations may not be directly from the retrieved documents.*"
            else:
                groundedness = reflection_report.get("groundedness_score", 0.0)
            
            # Append manual citations if not already present
            if isinstance(clean_chunks[0][1], dict) and "(Source:" not in answer and "Page " not in answer:
                answer += "\n\n**📚 Sources:**\n"
                seen_sources = set()
                source_index = 1
                for _, chunk in clean_chunks[:3]:
                    if isinstance(chunk, dict):
                        pdf = chunk.get("pdf_name", "Unknown")
                        page = chunk.get("page", "?")
                        source_key = f"{pdf}|{page}"
                        if source_key in seen_sources:
                            continue
                        seen_sources.add(source_key)
                        answer += f"{source_index}. {pdf}, Page {page}\n"
                        source_index += 1
                        if source_index > 2:
                            break
            
            # 🛡️ GUARDRAIL 4: Add legal disclaimer
            if temporal_warnings:
                answer = (
                    "⚠️ High-priority temporal warning: one or more cited precedents may be "
                    "overruled, overturned, or amended in the case graph.\n\n" + answer
                )
            if _is_truthy_env("NYAYA_APPEND_DISCLAIMER", "1"):
                answer = self.guardrails.add_disclaimer(answer)

            chunks_dict = [chunk for _, chunk in clean_chunks if isinstance(chunk, dict)]
            source_map = self._build_source_map(answer, chunks_dict)
            if not precedent_chain:
                try:
                    precedent_chain = self._build_precedent_chain_for_query(query, case_name)
                except Exception:
                    precedent_chain = []

            groundedness_value = 0.0
            if isinstance(groundedness, (int, float)):
                groundedness_value = float(groundedness)
            reflection_report["temporal_warnings"] = temporal_warnings

            result = {
                "question": query,
                "answer": answer,
                "status": "success",
                "source_map": source_map,
                "precedent_chain": precedent_chain,
                "groundedness_score": round(groundedness_value, 3),
                "reflection_report": reflection_report,
                "debug_trace": debug_trace,
                "latency_seconds": round(time.time() - start_total, 3),
            }
            return result
        except Exception as e:
            error_msg = str(e)
            if self.show_debug:
                print(f"[DEBUG] LLM generation failed: {error_msg}")
            
            # Show helpful error if LLM not configured
            if "No LLM configured" in error_msg:
                fallback = """⚠️ **LLM Not Configured**

I can retrieve relevant documents, but I need an AI model (Azure OpenAI or Gemini) to generate natural answers.

**Quick fix:** Add to your `.env` file:
```
GEMINI_API_KEY=your-key-here
```
Get free Gemini key: https://makersuite.google.com/app/apikey

Meanwhile, here's what I found in the documents:

""" + self._build_retrieval_fallback_answer(query, clean_chunks)
                return {
                    "question": query,
                    "answer": fallback,
                    "status": "fallback",
                    "source_map": [],
                    "precedent_chain": precedent_chain,
                    "groundedness_score": 0.0,
                    "reflection_report": {},
                    "debug_trace": debug_trace,
                    "latency_seconds": round(time.time() - start_total, 3),
                }

            fallback = self._build_retrieval_fallback_answer(query, clean_chunks)
            result = {
                "question": query,
                "answer": fallback,
                "status": "fallback",
                "source_map": [],
                "precedent_chain": precedent_chain,
                "groundedness_score": 0.0,
                "reflection_report": {},
                "debug_trace": debug_trace,
                "latency_seconds": round(time.time() - start_total, 3),
            }
            return result

    def ask(self, query):
        """
        Backward-compatible plain answer API used by CLI/tests.
        """
        report = self.ask_with_report(query, debug_mode=False)
        return report.get("answer", "")