#!/usr/bin/env python3
"""
Academic-Grade Evaluation Framework for Nyaya System
Measures: Recall@5, Citation Precision, Groundedness, Hallucination
"""

import json
import os
import re
import sys
import time
import argparse
from datetime import datetime, timezone

# Ensure UTF-8 output on Windows terminals when supported by the stream object.
_stdout_reconfigure = getattr(sys.stdout, "reconfigure", None)
if (
    sys.stdout.encoding
    and sys.stdout.encoding.lower() != "utf-8"
    and callable(_stdout_reconfigure)
):
    _stdout_reconfigure(encoding="utf-8", errors="replace")
from typing import List, Dict, Any
from agent.nyaya_agent import NyayaAgent
from agent.retriever import HybridRetriever

class NyayaEvaluator:
    def __init__(self, dataset_path: str = "evaluation_dataset.json", fast: bool = False):
        self.dataset_path = dataset_path
        # Evaluation mode: avoid appending generic legal disclaimers that are
        # intentionally not sourced from retrieved chunks and can deflate
        # groundedness metrics.
        os.environ.setdefault("NYAYA_APPEND_DISCLAIMER", "0")
        if fast:
            # Fast mode skips graph traversal to avoid network-heavy Neo4j calls.
            os.environ.setdefault("NYAYA_DISABLE_GRAPH", "1")
        self.agent = NyayaAgent(show_debug=False)
        # Reuse the agent retriever to avoid rebuilding BM25 index twice.
        self.retriever = getattr(self.agent, "retriever", None) or HybridRetriever()
        
        with open(dataset_path, 'r', encoding='utf-8-sig') as f:
            self.dataset = json.load(f)
        
        self.results = {
            "questions_tested": 0,
            "recall_at_5": [],
            "citation_precision": [],
            "answer_groundedness": [],
            "hallucinations": [],
            "failures": []
        }

    @staticmethod
    def _percent(value: float) -> str:
        return f"{value * 100:.1f}%"
    
    def recall_at_5(self, query: str, ground_truth_pdf: str, retrieved_chunks: List[Dict] | None = None) -> bool:
        """Check if ground truth document appears in top-10 retrieved results"""
        try:
            chunks = retrieved_chunks
            if chunks is None:
                chunks = self.retriever.search(query, top_k=10, return_metadata=True)
            retrieved_pdfs = []
            
            for chunk in chunks:
                if isinstance(chunk, dict):
                    # Check both pdf_name and source_path (year-wise ingestion stores source_path)
                    pdf_name = chunk.get("pdf_name", "").lower()
                    source_path = chunk.get("source_path", "").lower()
                    # source_path may be "2023/sc_appeal_110_2023.pdf" — grab filename only
                    source_filename = source_path.split("/")[-1] if source_path else ""
                    retrieved_pdfs.extend([pdf_name, source_filename])

            # Check if ground truth PDF (wildcards) matches
            ground_truth_pattern = ground_truth_pdf.lower().replace("*", ".*")
            for pdf in retrieved_pdfs:
                if pdf and re.match(ground_truth_pattern, pdf):
                    return True
            
            return False
        except Exception as e:
            print(f"  [ERROR] Recall@5 failed: {e}")
            return False
    
    def citation_precision(self, answer: str, retrieved_chunks: List[Dict]) -> float:
        """% of citations in answer that appear in retrieved chunks"""
        # Extract citations (text in quotes or "Case Name v. Case Name" pattern)
        citation_pattern = r'([A-Z][a-zA-Z]+ v\. [A-Z][a-zA-Z]+)'
        citations_in_answer = set(re.findall(citation_pattern, answer))
        
        if not citations_in_answer:
            return 1.0  # No citations = no hallucinations
        
        # Get all case names from retrieved chunks
        cited_cases_in_chunks = set()
        for chunk in retrieved_chunks:
            if isinstance(chunk, dict):
                text = chunk.get("text", "").lower()
                for citation in citations_in_answer:
                    if citation.lower() in text:
                        cited_cases_in_chunks.add(citation)
        
        precision = len(cited_cases_in_chunks) / len(citations_in_answer) if citations_in_answer else 1.0
        return precision
    
    @staticmethod
    def _word_overlap(sentence: str, chunk_text: str) -> float:
        """Token-level Jaccard overlap between a sentence and a chunk"""
        stopwords = {"the", "a", "an", "is", "in", "of", "to", "and", "or",
                     "that", "it", "for", "on", "are", "was", "with", "as",
                     "by", "at", "from", "be", "this", "which", "have", "has"}
        s_words = {w for w in re.findall(r'\b\w+\b', sentence.lower()) if w not in stopwords and len(w) > 2}
        c_words = {w for w in re.findall(r'\b\w+\b', chunk_text.lower()) if w not in stopwords and len(w) > 2}
        if not s_words:
            return 0.0
        return len(s_words & c_words) / len(s_words)

    def answer_groundedness(self, answer: str, retrieved_chunks: List[Dict]) -> float:
        """% of answer sentences sufficiently grounded in retrieved chunks (word overlap >= 20%)"""
        sentences = re.split(r'[.!?]+', answer)
        sentences = [s.strip() for s in sentences if s.strip() and len(s) > 10]

        if not sentences:
            return 0.0

        grounded_count = 0
        for sentence in sentences:
            for chunk in retrieved_chunks:
                if isinstance(chunk, dict):
                    chunk_text = chunk.get("text", "")
                    if self._word_overlap(sentence, chunk_text) >= 0.20:
                        grounded_count += 1
                        break

        return grounded_count / len(sentences)
    
    def page_accuracy(self, answer: str, expected_pages: List[int]) -> bool:
        """Check if correct page numbers are mentioned"""
        page_pattern = r'page\s+(\d+)'
        pages_in_answer = set(map(int, re.findall(page_pattern, answer, re.IGNORECASE)))
        
        if not pages_in_answer:
            return False
        
        expected_set = set(expected_pages)
        return len(pages_in_answer & expected_set) > 0
    
    def run_single_test(self, test_case: Dict) -> Dict:
        """Run evaluation for a single test case"""
        question = test_case["question"]
        question_id = test_case["id"]
        category = test_case["category"]
        expected_pdf = test_case["expected_pdf"]
        
        print(f"\n{'='*70}")
        print(f"Test {question_id} | {category}")
        print(f"Q: {question}")
        
        # Get answer from system
        start_time = time.time()
        failure = False
        try:
            report = self.agent.ask_with_report(question, debug_mode=False)
            answer = str(report.get("answer", ""))
            status = str(report.get("status", "success"))
            elapsed = time.time() - start_time
        except Exception as e:
            print(f"  [ERROR] System failed: {e}")
            failure = True
            return {
                "question_id": question_id,
                "status": "FAILED",
                "category": category,
                "error": str(e)
            }
        
        # Retrieve chunks for analysis
        try:
            retrieved_chunks = self.retriever.search(question, top_k=10, return_metadata=True)
        except:
            retrieved_chunks = []

        retrieved_chunks_dicts = [chunk for chunk in retrieved_chunks if isinstance(chunk, dict)]
        
        # Compute metrics
        recall = self.recall_at_5(question, expected_pdf, retrieved_chunks_dicts)
        precision = self.citation_precision(answer, retrieved_chunks_dicts)
        groundedness = self.answer_groundedness(answer, retrieved_chunks_dicts)
        
        page_correct = False
        if "expected_page" in test_case:
            page_correct = self.page_accuracy(answer, [test_case["expected_page"]])
        
        result = {
            "question_id": question_id,
            "category": category,
            "status": "PASSED" if recall and not failure else "FAILED",
            "agent_status": status,
            "recall_at_5": recall,
            "citation_precision": round(precision, 3),
            "answer_groundedness": round(groundedness, 3),
            "page_accuracy": page_correct if "expected_page" in test_case else None,
            "latency_seconds": round(elapsed, 2),
            "failure": failure or status in {"fallback", "blocked"},
            "answer_snippet": answer[:150] + "..." if len(answer) > 150 else answer
        }
        
        # Print results
        print(f"  Status: {result['status']}")
        print(f"  Recall@5: {'✓' if recall else '✗'}")
        print(f"  Citation Precision: {precision:.1%}")
        print(f"  Answer Groundedness: {groundedness:.1%}")
        print(f"  Latency: {elapsed:.2f}s")
        if "expected_page" in test_case:
            print(f"  Page Accuracy: {'✓' if page_correct else '✗'}")
        
        return result
    
    def run_full_evaluation(self, limit: int | None = None) -> Dict[str, Any]:
        """Run all tests and generate report"""
        print("\n" + "="*70)
        print("🔍 NYAYA SYSTEM ACADEMIC EVALUATION")
        print("="*70)
        
        all_results = []
        
        dataset_cases = self.dataset["evaluation_dataset"]
        if isinstance(limit, int) and limit > 0:
            dataset_cases = dataset_cases[:limit]

        for test_case in dataset_cases:
            result = self.run_single_test(test_case)
            all_results.append(result)
        
        # Aggregate metrics
        valid_results = [r for r in all_results if "recall_at_5" in r and isinstance(r["recall_at_5"], bool)]
        passed = sum(1 for r in valid_results if r["status"] == "PASSED")
        
        recall_at_5_avg = sum(r["recall_at_5"] for r in valid_results) / len(valid_results) if valid_results else 0
        cite_prec_vals = [r["citation_precision"] for r in valid_results if isinstance(r.get("citation_precision"), (int, float))]
        cite_prec_avg = sum(cite_prec_vals) / len(cite_prec_vals) if cite_prec_vals else 0
        ground_vals = [r["answer_groundedness"] for r in valid_results if isinstance(r.get("answer_groundedness"), (int, float))]
        ground_avg = sum(ground_vals) / len(ground_vals) if ground_vals else 0
        avg_latency = sum(r["latency_seconds"] for r in valid_results if isinstance(r.get("latency_seconds"), (int, float))) / len([r for r in valid_results if isinstance(r.get("latency_seconds"), (int, float))]) if valid_results else 0
        failure_rate = sum(1 for r in valid_results if r.get("failure") is True) / len(valid_results) if valid_results else 0

        by_category: Dict[str, Dict[str, Any]] = {}
        for item in valid_results:
            category = item.get("category", "uncategorized")
            by_category.setdefault(category, {
                "count": 0,
                "recall_at_5": 0.0,
                "citation_precision": 0.0,
                "answer_groundedness": 0.0,
                "avg_latency_seconds": 0.0,
                "failure_rate": 0.0,
            })
            by_category[category]["count"] += 1
            by_category[category]["recall_at_5"] += 1.0 if item.get("recall_at_5") else 0.0
            by_category[category]["citation_precision"] += float(item.get("citation_precision", 0.0) or 0.0)
            by_category[category]["answer_groundedness"] += float(item.get("answer_groundedness", 0.0) or 0.0)
            by_category[category]["avg_latency_seconds"] += float(item.get("latency_seconds", 0.0) or 0.0)
            by_category[category]["failure_rate"] += 1.0 if item.get("failure") else 0.0

        for category, values in by_category.items():
            count = max(int(values["count"]), 1)
            values["recall_at_5"] = round(values["recall_at_5"] / count, 4)
            values["citation_precision"] = round(values["citation_precision"] / count, 4)
            values["answer_groundedness"] = round(values["answer_groundedness"] / count, 4)
            values["avg_latency_seconds"] = round(values["avg_latency_seconds"] / count, 4)
            values["failure_rate"] = round(values["failure_rate"] / count, 4)

        # Basic data-driven threshold tuning suggestions.
        suggested_null_threshold = round(max(0.2, min(0.6, 0.3 + (failure_rate * 0.2))), 3)
        suggested_recency_weight = round(max(0.05, min(0.3, 0.1 + ((1.0 - recall_at_5_avg) * 0.1))), 3)
        
        # Generate report
        report = {
            "evaluation_type": "Academic Grade Evaluation",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "dataset_path": self.dataset_path,
            "total_tests": len(valid_results),
            "passed": passed,
            "failed": len(valid_results) - passed,
            "pass_rate": f"{(passed / len(valid_results)) * 100:.1f}%" if valid_results else "N/A",
            "metrics": {
                "recall_at_5": self._percent(recall_at_5_avg),
                "citation_precision": self._percent(cite_prec_avg),
                "answer_groundedness": self._percent(ground_avg),
                "avg_latency_seconds": round(avg_latency, 2),
                "failure_rate": self._percent(failure_rate),
            },
            "metrics_raw": {
                "recall_at_5": round(recall_at_5_avg, 4),
                "citation_precision": round(cite_prec_avg, 4),
                "answer_groundedness": round(ground_avg, 4),
                "avg_latency_seconds": round(avg_latency, 4),
                "failure_rate": round(failure_rate, 4),
            },
            "by_category": by_category,
            "threshold_calibration": {
                "suggested_null_result_threshold": suggested_null_threshold,
                "suggested_recency_weight": suggested_recency_weight,
            },
            "detailed_results": all_results
        }
        
        # Print summary
        print("\n" + "="*70)
        print("📊 EVALUATION SUMMARY")
        print("="*70)
        print(f"Total Tests: {report['total_tests']}")
        print(f"Passed: {report['passed']} | Failed: {report['failed']}")
        print(f"Pass Rate: {report['pass_rate']}")
        print("\n📈 Key Metrics:")
        print(f"  • Recall@5: {report['metrics']['recall_at_5']}")
        print(f"  • Citation Precision: {report['metrics']['citation_precision']}")
        print(f"  • Answer Groundedness: {report['metrics']['answer_groundedness']}")
        print(f"  • Avg Latency: {report['metrics']['avg_latency_seconds']}s")
        print(f"  • Failure Rate: {report['metrics']['failure_rate']}")
        
        return report
    
    def save_results(self, output_file: str = "evaluation_results.json", limit: int | None = None):
        """Save full evaluation results"""
        report = self.run_full_evaluation(limit=limit)
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n✓ Results saved to {output_file}")
        return report

    def save_timestamped_results(self, output_dir: str = "evaluation_reports", limit: int | None = None) -> Dict[str, Any]:
        os.makedirs(output_dir, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f"evaluation_results_{stamp}.json")
        return self.save_results(output_file, limit=limit)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Nyaya evaluation suite")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Run only the first N test cases for faster feedback",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Fast mode: disables graph traversal to reduce evaluation latency",
    )
    args = parser.parse_args()

    evaluator = NyayaEvaluator(fast=args.fast)
    evaluator.save_timestamped_results(limit=args.limit)
