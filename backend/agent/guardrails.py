

import re
from typing import Dict, List, Tuple


class LegalGuardrails:
   
    
    def __init__(self):
        self.forbidden_patterns = [
            r'\bi am a lawyer\b',
            r'\byou should definitely\b',
            r'\bguaranteed to win\b',
            r'\bwill certainly succeed\b',
        ]
        
        self.citation_patterns = [
            r'([A-Z][a-z]+\s+v\.?\s+[A-Z][a-z]+)',  # Case citations
            r'Section\s+\d+',  # Statute sections
            r'\d+\s+(?:NLR|SLR)',  # Sri Lankan law reports
        ]
    
    def check_response(self, response: str, context_chunks: List[Dict]) -> Tuple[bool, str, List[str]]:
        """
        Validate response against guardrails
        
        Returns:
            (is_valid, modified_response, warnings)
        """
        warnings = []
        modified = response
        
        # 1. Check for forbidden patterns (legal liability)
        for pattern in self.forbidden_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                warnings.append(f"Removed overly confident legal advice: {pattern}")
                modified = re.sub(pattern, "[removed - see lawyer]", modified, flags=re.IGNORECASE)
        
        # 2. Verify citations are grounded
        citations_in_response = []
        for pattern in self.citation_patterns:
            citations_in_response.extend(re.findall(pattern, response))
        
        if citations_in_response:
            grounded_citations = self._verify_citations_grounded(citations_in_response, context_chunks)
            if len(grounded_citations) < len(citations_in_response) * 0.5:
                warnings.append("Less than 50% of citations appear in retrieved documents")
        
        # 3. Length check (prevent overlong answers)
        if len(modified.split()) > 500:
            warnings.append("Response too long (>500 words), truncating")
            sentences = modified.split('. ')
            modified = '. '.join(sentences[:15]) + '.'  # Keep first 15 sentences
        
        # 4. Tone check - ensure professional
        informal_words = ['gonna', 'wanna', 'yeah', 'nope', 'yep']
        for word in informal_words:
            if re.search(rf'\b{word}\b', modified, re.IGNORECASE):
                warnings.append(f"Informal language detected: {word}")
        
        is_valid = len(warnings) == 0 or all('' in w for w in warnings)
        
        return is_valid, modified, warnings
    
    def _verify_citations_grounded(self, citations: List[str], context_chunks: List[Dict]) -> List[str]:
        """Check which citations appear in retrieved context"""
        grounded = []
        
        for citation in citations:
            for chunk in context_chunks:
                text = chunk.get("text", "").lower()
                if citation.lower() in text:
                    grounded.append(citation)
                    break
        
        return grounded
    
    def add_disclaimer(self, response: str) -> str:
        """Add legal disclaimer to response"""
        if "**Legal Disclaimer:**" in response:
            return response

        disclaimer = """

---
**Legal Disclaimer:**
This information is for educational purposes only and does not constitute legal advice. 
Sri Lankan law is complex—consult a qualified attorney for your specific situation.
"""
        return response + disclaimer

    @staticmethod
    def _build_context_text(context_chunks: List[Dict]) -> str:
        return "\n".join((chunk.get("text", "") if isinstance(chunk, dict) else "") for chunk in context_chunks).lower()

    def reflection_self_check(self, draft_answer: str, context_chunks: List[Dict]) -> Tuple[str, Dict[str, object]]:
        """
        Remove unsupported claims from the answer before final output.
        Rules:
        - If "Section N" is mentioned but does not appear in retrieved context, drop that sentence.
        - If "Page N" is mentioned but no retrieved chunk has that page, drop that sentence.
        """
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', draft_answer) if s.strip()]
        if not sentences:
            return draft_answer, {
                "removed_sentences": 0,
                "checked_sentences": 0,
                "reason_counts": {},
                "groundedness_score": 0.0,
            }

        context_text = self._build_context_text(context_chunks)
        known_pages = {
            str(chunk.get("page"))
            for chunk in context_chunks
            if isinstance(chunk, dict) and chunk.get("page") is not None
        }

        kept = []
        removed = 0
        reason_counts = {"section": 0, "page": 0}

        for sentence in sentences:
            sentence_lower = sentence.lower()

            section_refs = re.findall(r'section\s+\d+[a-zA-Z0-9-]*', sentence_lower)
            page_refs = re.findall(r'page\s+(\d+)', sentence_lower)

            unsupported_section = any(section_ref not in context_text for section_ref in section_refs)
            unsupported_page = any(page_num not in known_pages for page_num in page_refs)

            if unsupported_section:
                removed += 1
                reason_counts["section"] += 1
                continue

            if unsupported_page:
                removed += 1
                reason_counts["page"] += 1
                continue

            kept.append(sentence)

        revised = " ".join(kept).strip()
        if not revised:
            revised = draft_answer

        groundedness_score = (len(kept) / len(sentences)) if sentences else 0.0
        report = {
            "removed_sentences": removed,
            "checked_sentences": len(sentences),
            "reason_counts": reason_counts,
            "groundedness_score": groundedness_score,
        }
        return revised, report


class CitationValidator:
    """Validates that all citations in response are properly sourced"""
    
    @staticmethod
    def extract_citations(text: str) -> List[str]:
        """Extract all case citations from text"""
        pattern = r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+v\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})'
        return re.findall(pattern, text)
    
    @staticmethod
    def validate_against_sources(citations: List[str], sources: List[Dict]) -> Dict[str, bool]:
        """Check each citation appears in source documents"""
        validation = {}
        
        for citation in citations:
            found = False
            for source in sources:
                if citation.lower() in source.get("text", "").lower():
                    found = True
                    break
            validation[citation] = found
        
        return validation
    
    @staticmethod
    def get_groundedness_score(validation: Dict[str, bool]) -> float:
        """Calculate % of citations that are grounded"""
        if not validation:
            return 1.0  # No citations = no hallucination
        
        grounded_count = sum(1 for is_grounded in validation.values() if is_grounded)
        return grounded_count / len(validation)


class SafetyFilter:
    """Filter unsafe or inappropriate legal advice"""
    
    UNSAFE_PATTERNS = [
        (r'\bhow to commit\b', "Instructions for illegal activity"),
        (r'\bforge\b.*\bdocument', "Document forgery"),
        (r'\bevade\b.*\btax', "Tax evasion"),
        (r'\blie\b.*\bcourt', "Perjury encouragement"),
    ]
    
    @classmethod
    def check_safety(cls, query: str) -> Tuple[bool, str]:
        """
        Check if query is requesting unsafe/illegal advice
        
        Returns:
            (is_safe, reason)
        """
        query_lower = query.lower()
        
        for pattern, reason in cls.UNSAFE_PATTERNS:
            if re.search(pattern, query_lower):
                return False, reason
        
        return True, ""
    
    @classmethod
    def get_refusal_message(cls, reason: str) -> str:
        """Generate appropriate refusal message"""
        return f"""I cannot provide advice on: {reason}

Nyaya is designed to help with legitimate legal questions about Sri Lankan law. 
If you have a question about legal procedures, rights, or case law, I'm happy to help with that instead."""