from graph.neo4j_loader import driver, normalize_title
from difflib import SequenceMatcher
import re


_STOP_TOKENS = {
    "the", "a", "an", "and", "of", "in", "for", "on", "to", "with", "by",
    "from", "at", "as", "is", "was", "were", "be", "been", "being",
    "that", "this", "these", "those", "there", "here", "it", "their",
    "his", "her", "its", "which", "who", "whom", "where", "when", "then",
    "however", "therefore", "thus", "hence", "said", "see", "vide", "per",
    "case", "cases", "reported", "report", "vol", "volume"
}


def _split_title(title):
    if not title:
        return None, None
    norm = normalize_title(title)
    if not norm or " v. " not in norm:
        return None, None
    left, right = norm.split(" v. ", 1)
    return left.strip(), right.strip()


def _normalize_key(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"([a-z])\1{2,}", r"\1\1", text)
    tokens = [t for t in text.split() if len(t) > 1 and t not in _STOP_TOKENS]
    return " ".join(tokens)


def _token_jaccard(a, b):
    a_set = set(a.split())
    b_set = set(b.split())
    if not a_set or not b_set:
        return 0.0
    return len(a_set & b_set) / len(a_set | b_set)


def _similar(a, b):
    return SequenceMatcher(None, a, b).ratio()


def _merge_cases(records, similarity_threshold=0.88):
    clusters = []
    for title, count in records:
        left, right = _split_title(title)
        if not left or not right:
            continue
        left_key = _normalize_key(left)
        right_key = _normalize_key(right)
        if not left_key or not right_key:
            continue

        merged = False
        for cluster in clusters:
            left_sim = max(_similar(left_key, cluster["left_key"]), _token_jaccard(left_key, cluster["left_key"]))
            right_sim = max(_similar(right_key, cluster["right_key"]), _token_jaccard(right_key, cluster["right_key"]))
            if left_sim >= similarity_threshold and right_sim >= similarity_threshold:
                cluster["count"] += count
                merged = True
                break

        if not merged:
            clusters.append({
                "title": normalize_title(title) or title,
                "left_key": left_key,
                "right_key": right_key,
                "count": count,
            })

    clusters.sort(key=lambda x: x["count"], reverse=True)
    return clusters

def show_most_cited_cases():
    with driver.session() as session:
        result = session.run("""
            MATCH (c:Case)
            WITH c, COUNT { (c)<-[:CITES]-() } AS citations
            WHERE citations > 0
            RETURN c.title AS case, citations
            ORDER BY citations DESC
        """)
        rows = [(record["case"], record["citations"]) for record in result]
        clusters = _merge_cases(rows)
        for cluster in clusters:
            print(f"{cluster['title']} | Citations: {cluster['count']}")
