from neo4j import GraphDatabase
import logging
import os
from dotenv import load_dotenv
from graph.neo4j_loader import normalize_title
from resilience import CircuitBreaker, call_with_retry

# Suppress noisy bolt-protocol connection error logs from the Neo4j driver.
# Python exceptions from failed queries are already caught and handled gracefully.
logging.getLogger("neo4j").setLevel(logging.CRITICAL)
logging.getLogger("neo4j.debug").setLevel(logging.CRITICAL)

load_dotenv()


class CitationGraph:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USER")
        password = os.getenv("NEO4J_PASSWORD")
        
        if not uri or not user or not password:
            raise ValueError("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set in .env")
        
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=30.0)

    def _run_query(self, query, **params):
        def execute():
            with self.driver.session() as session:
                return list(session.run(query, **params))

        return call_with_retry(
            execute,
            retries=2,
            timeout_seconds=20,
            circuit_breaker=self.breaker,
        )

    def get_case_info(self, case_name):
        normalized = normalize_title(case_name)
        if not normalized:
            return None
        query = """
        MATCH (c:Case {title: $title})
        OPTIONAL MATCH (c)<-[:CITES]-(other)
        RETURN c.title AS case, count(other) AS citation_count, coalesce(c.status, 'Unknown') AS status
        """

        records = self._run_query(query, title=normalized)
        return records[0] if records else None

    def get_case_status(self, case_name):
        normalized = normalize_title(case_name)
        if not normalized:
            return "Unknown"

        query = """
        MATCH (c:Case {title: $title})
        RETURN coalesce(c.status, 'Unknown') AS status
        LIMIT 1
        """
        records = self._run_query(query, title=normalized)
        record = records[0] if records else None
        if not record:
            return "Unknown"
        return record.get("status") or "Unknown"

    def get_most_cited(self, limit=10):
        query = """
        MATCH (c:Case)
        WITH c, COUNT { (c)<-[:CITES]-() } AS citations
        WHERE citations > 0
        RETURN c.title AS case, citations
        ORDER BY citations DESC
        LIMIT $limit
        """

        records = self._run_query(query, limit=limit)
        return [(r["case"], r["citations"]) for r in records]

    def get_cited_cases(self, case_name, limit=20):
        normalized = normalize_title(case_name)
        if not normalized:
            return []

        query = """
        MATCH (source:Case {title: $title})-[:CITES]->(cited:Case)
        RETURN cited.title AS case
        ORDER BY cited.title
        LIMIT $limit
        """

        records = self._run_query(query, title=normalized, limit=limit)
        return [r["case"] for r in records]

    def get_cited_by(self, case_name, limit=20):
        normalized = normalize_title(case_name)
        if not normalized:
            return []

        query = """
        MATCH (cited:Case {title: $title})<-[:CITES]-(source:Case)
        RETURN source.title AS case
        ORDER BY source.title
        LIMIT $limit
        """

        records = self._run_query(query, title=normalized, limit=limit)
        return [r["case"] for r in records]

    def find_similar_cases(self, case_name, limit=10):
        normalized = normalize_title(case_name)
        if not normalized:
            return []

        tokens = [token for token in normalized.split() if len(token) > 2]
        if not tokens:
            return []

        token = tokens[0]
        query = """
        MATCH (c:Case)
        WHERE toLower(c.title) CONTAINS $token
        RETURN c.title AS case
        ORDER BY c.title
        LIMIT $limit
        """

        records = self._run_query(query, token=token, limit=limit)
        return [r["case"] for r in records]

    def get_precedent_history(self, case_name, limit=20):
        """
        Return newer cases that cite a target case.
        This approximates "challenged/upheld in later cases" when explicit treatment labels are absent.
        """
        normalized = normalize_title(case_name)
        if not normalized:
            return []

        query = """
        MATCH (target:Case {title: $title})<-[:CITES]-(later:Case)
        RETURN later.title AS case
        ORDER BY later.title
        LIMIT $limit
        """

        records = self._run_query(query, title=normalized, limit=limit)
        return [r["case"] for r in records]

    def get_top_related_precedents(self, case_name, limit=3):
        """
        Return top related precedents ranked by inbound citation count.
        """
        normalized = normalize_title(case_name)
        if not normalized:
            return []

        query = """
        MATCH (anchor:Case {title: $title})-[:CITES]->(related:Case)
        WITH related, COUNT { (related)<-[:CITES]-() } AS citation_count
        RETURN related.title AS case, citation_count, coalesce(related.status, 'Unknown') AS status
        ORDER BY citation_count DESC, case ASC
        LIMIT $limit
        """

        records = self._run_query(query, title=normalized, limit=limit)
        return [
            {"case": r["case"], "citation_count": r["citation_count"], "status": r.get("status", "Unknown")}
            for r in records
        ]

    def get_temporal_warnings(self, case_name, limit=10):
        """
        Return warnings when a cited precedent is marked as overruled/overturned/amended.
        """
        normalized = normalize_title(case_name)
        if not normalized:
            return []

        query = """
        MATCH (anchor:Case {title: $title})-[:CITES]->(precedent:Case)
        WITH precedent, toLower(coalesce(precedent.status, 'unknown')) AS status
        WHERE status IN ['overruled', 'overturned', 'amended']
        RETURN precedent.title AS case, status
        LIMIT $limit
        """

        records = self._run_query(query, title=normalized, limit=limit)
        return [{"case": r["case"], "status": r["status"]} for r in records]

    def get_query_precedent_chain(self, query_text, limit=3):
        """
        Resolve candidate cases from free text and return top related precedents.
        Useful for API-level graph context even when user does not provide an exact title.
        """
        if not query_text or len(query_text.strip()) < 3:
            return []

        similar_cases = self.find_similar_cases(query_text, limit=5)
        if not similar_cases:
            return []

        chain = []
        for case in similar_cases:
            related = self.get_top_related_precedents(case, limit=limit)
            if related:
                chain.append({"anchor_case": case, "related": related})

        return chain[:limit]
