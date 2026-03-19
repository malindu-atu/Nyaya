# consolidate_graph.py
"""
Post-processing script to merge duplicate case nodes in Neo4j using fuzzy matching.
Run this MANUALLY after ingestion to consolidate OCR variants: python consolidate_graph.py
"""

from graph.neo4j_loader import driver, normalize_title, clean_case_name, _normalize_key, _similar, _token_jaccard

def consolidate_duplicate_cases(similarity_threshold=0.85):
    """
    Finds and merges near-duplicate case nodes in Neo4j using title-based matching.
    Uses MERGE to combine nodes efficiently.
    """
    print("\nConsolidating duplicate case nodes...")

    
    with driver.session() as session:
        # Get all unique case titles with citation counts
        result = session.run("""
            MATCH (c:Case)
            WHERE EXISTS { (c)<-[:CITES]-() }
            RETURN c.title AS title
        """)
        
        cases = [record["title"] for record in result]
        
    print(f"Found {len(cases)} cited cases to check for duplicates...")
    
    # Group similar cases by cleaned title
    clusters = []
    for title in cases:
        cleaned = normalize_title(clean_case_name(title))
        if not cleaned:
            continue
        parts = cleaned.split(" v. ")
        if len(parts) != 2:
            continue

        left_key = _normalize_key(parts[0])
        right_key = _normalize_key(parts[1])
        full_key = _normalize_key(cleaned)
        
        if not left_key or not right_key or not full_key:
            continue
        
        merged = False
        for cluster in clusters:
            left_sim = max(_similar(left_key, cluster["left_key"]), _token_jaccard(left_key, cluster["left_key"]))
            right_sim = max(_similar(right_key, cluster["right_key"]), _token_jaccard(right_key, cluster["right_key"]))
            full_sim = max(_similar(full_key, cluster["full_key"]), _token_jaccard(full_key, cluster["full_key"]))
            
            # Use both party-level and full-title similarity
            if (left_sim >= similarity_threshold and right_sim >= similarity_threshold) or full_sim >= (similarity_threshold + 0.05):
                cluster["titles"].append(title)
                merged = True
                break
        
        if not merged:
            clusters.append({
                "canonical": cleaned,
                "left_key": left_key,
                "right_key": right_key,
                "full_key": full_key,
                "titles": [title]
            })
    
    # Find clusters with duplicates or titles needing normalization
    clusters_to_fix = [
        c for c in clusters
        if len(c["titles"]) > 1 or any(normalize_title(clean_case_name(t)) != c["canonical"] for t in c["titles"])
    ]
    print(f"Found {len(clusters_to_fix)} clusters to normalize/merge")
    
    if not clusters_to_fix:
        print("No duplicates to merge")
        return 0
    
    # Merge duplicate clusters
    merged_count = 0
    for i, cluster in enumerate(clusters_to_fix, 1):
        canonical = cluster["canonical"]
        duplicates = [t for t in cluster["titles"] if normalize_title(clean_case_name(t)) != canonical]
        
        print(f"[{i}/{len(clusters_to_fix)}] Merging {len(duplicates)} variants into: {canonical}")
        
        with driver.session() as session:
            for dup_title in duplicates:
                # Redirect citations from duplicate to canonical (using title matching)
                session.run("""
                    MATCH (dup:Case {title: $dup_title})
                    MERGE (canonical:Case {title: $canonical_title})
                    WITH canonical, dup
                    OPTIONAL MATCH (source)-[r:CITES]->(dup)
                    WITH canonical, dup, source, r
                    WHERE source IS NOT NULL
                    MERGE (source)-[:CITES]->(canonical)
                    DELETE r
                    WITH dup
                    DETACH DELETE dup
                """, dup_title=dup_title, canonical_title=canonical)
                
                merged_count += 1
    
    print(f"Merged {merged_count} duplicate nodes")
    return merged_count

if __name__ == "__main__":
    consolidate_duplicate_cases()
