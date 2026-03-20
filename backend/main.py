import sys
from pipeline.ingestion import process_all_pdfs, retry_deferred_pdfs
from graph.ranking_engine import show_most_cited_cases



if __name__ == "__main__":
    if "--retry-deferred" in sys.argv:
        retry_deferred_pdfs()
    else:
        process_all_pdfs()

    print("\n--- Citation Ranking ---")
    show_most_cited_cases()
