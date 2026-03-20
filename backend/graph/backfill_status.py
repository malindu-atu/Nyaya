"""
Backfill/migrate Neo4j Case.status values for existing nodes.
Usage:
  python -m graph.backfill_status
"""

from neo4j import GraphDatabase
from config import URI, USER, PASSWORD


def backfill_status() -> dict:
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

    set_unknown_query = """
    MATCH (c:Case)
    WHERE c.status IS NULL OR trim(toString(c.status)) = ''
    SET c.status = 'Unknown'
    RETURN count(c) AS updated
    """

    normalize_query = """
    MATCH (c:Case)
    WHERE c.status IS NOT NULL
    WITH c, toLower(trim(toString(c.status))) AS normalized
    SET c.status = CASE
        WHEN normalized IN ['overruled', 'overturned', 'reversed'] THEN 'Overruled'
        WHEN normalized IN ['amended', 'modified'] THEN 'Amended'
        WHEN normalized IN ['active', 'upheld', 'affirmed'] THEN 'Active'
        ELSE 'Unknown'
    END
    RETURN count(c) AS normalized_count
    """

    with driver.session() as session:
        updated = session.run(set_unknown_query).single()
        normalized = session.run(normalize_query).single()

    driver.close()

    return {
        "updated_missing_status": int(updated["updated"]) if updated else 0,
        "normalized_status_rows": int(normalized["normalized_count"]) if normalized else 0,
    }


if __name__ == "__main__":
    report = backfill_status()
    print(report)
