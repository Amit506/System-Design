import json
import glob
import os

def check_examples(data, keywords, field_to_check=None):
    examples = []
    
    # Extract all examples nested anywhere in the JSON
    if 'children' in data:
        for child in data['children']:
            if 'explanation' in child and 'examples' in dict(child['explanation']):
                examples.extend(child['explanation']['examples'])
    
    if 'explanation' in data and 'examples' in data['explanation']:
        examples.extend(data['explanation']['examples'])

    for e in examples:
        if field_to_check:
            val = e.get(field_to_check, "")
            if isinstance(val, str) and any(kw.lower() in val.lower() for kw in keywords):
                return True
        else:
            # Check all string fields in example
            for k, v in e.items():
                if isinstance(v, str) and any(kw.lower() in v.lower() for kw in keywords):
                    return True
    return False

def check_internals(data):
    # 'INTERNAL:' is in the key_concepts definition
    concepts = []
    if 'children' in data:
         for child in data['children']:
              if 'explanation' in child and 'key_concepts' in child['explanation']:
                  concepts.extend(child['explanation']['key_concepts'])
    if 'explanation' in data and 'key_concepts' in data['explanation']:
        concepts.extend(data['explanation']['key_concepts'])
        
    for c in concepts:
        if 'INTERNAL:' in c.get('definition', ''):
             return True
    return False

def evaluate_chapter(filepath):
    with open(filepath, 'r') as f:
        try:
            data = json.load(f)
        except Exception:
             return filepath, 0, ["Invalid JSON"]
    
    score = 10
    reasons = []
    
    # 1. Internal Mechanics
    if not check_internals(data):
        score -= 2
        reasons.append("Missing deep 'INTERNAL:' mechanical explanations in key concepts.")
        
    # 2. FAANG Case Studies
    has_case_study = check_examples(data, ["architecture", "case study", "Netflix", "Uber", "Facebook", "AWS", "Google", "Stripe"]) 
    if not has_case_study:
         score -= 2
         reasons.append("Missing a dedicated real-world FAANG case study/architecture example.")
         
    # 3. Code Implementations
    has_code = check_examples(data, ["code", "implementation", "snippet", "def ", "function", "class ", "public static", "package "])
    if not has_code:
         score -= 2
         reasons.append("Missing concrete code snippet implementation.")
         
    # 4. Decision Matrices
    has_matrix = check_examples(data, ["matrix", "tradeoff", "----------------", "vs", "decision"])
    if not has_matrix:
         score -= 2
         reasons.append("Missing decision matrix for evaluating tradeoffs.")
         
    return data.get("title", os.path.basename(filepath)), max(0, score), reasons

def main():
    files = sorted(glob.glob('/Users/211446/Grokking-System-Design/course-content/chapters/ch*.json'))
    
    print("--- Course Curriculum Evaluation Report ---")
    all_premium = True
    for f in files:
        title, score, reasons = evaluate_chapter(f)
        print(f"Chapter: {title}")
        print(f"Rating: {score}/10")
        if score < 10:
            all_premium = False
            for r in reasons:
                print(f"  - {r}")
        print("-" * 40)
        
    if all_premium:
        print("\nFINAL VERDICT: CONTENT IS PREMIUM (FAANG Level)")
    else:
        print("\nFINAL VERDICT: CONTENT NEEDS ENRICHMENT")

if __name__ == '__main__':
    main()
