import json
import glob
import os

def check_dict_for_keyword(data, keywords):
    def recursive_check(item):
        if isinstance(item, dict):
            for k, v in item.items():
                if isinstance(v, str) and any(kw.lower() in v.lower() for kw in keywords):
                    return True
                if recursive_check(v):
                    return True
        elif isinstance(item, list):
            for i in item:
                if recursive_check(i):
                    return True
        elif isinstance(item, str):
            if any(kw.lower() in item.lower() for kw in keywords):
                return True
        return False
    return recursive_check(data)

def evaluate_chapter(filepath):
    with open(filepath, 'r') as f:
        try:
            data = json.load(f)
        except Exception:
             return filepath, 0, ["Invalid JSON"]
    
    score = 10
    reasons = []
    
    # 1. Java Code
    if not check_dict_for_keyword(data, ["java", "public static", "public class"]):
        score -= 1
        reasons.append("Missing explicit Java code snippet.")
        
    # 2. Python Code
    if not check_dict_for_keyword(data, ["python", "def ", "class ", "import "]):
        score -= 1
        reasons.append("Missing explicit Python code snippet.")
        
    # 3. Diagram
    if "diagram" not in data or not data["diagram"]:
        if not check_dict_for_keyword(data, ["mermaid", "excalidraw"]):
            score -= 2
            reasons.append("Missing architectural diagram.")
            
    # 4. Full knowledge with exceptions
    if not check_dict_for_keyword(data, ["exception", "error handling", "failure mode", "try catch", "try-catch"]):
        score -= 2
        reasons.append("Missing explicit Exception and failure handling documentation.")
        
    # 5. Library documentation & configs
    if not check_dict_for_keyword(data, ["library", "configuration", "modify", "parameter"]):
        score -= 2
        reasons.append("Missing library documentation and configuration modification parameters.")
        
    # 6. State techniques
    if not check_dict_for_keyword(data, ["state", "stateless", "stateful", "machine", "technique"]):
        score -= 2
        reasons.append("Missing state management techniques.")
         
    return data.get("title", os.path.basename(filepath)), max(0, score), reasons

def main():
    files = sorted(glob.glob('/Users/211446/Grokking-System-Design/course-content/chapters/*.json'))
    
    print("--- ULTRA-PREMIUM Curriculum Evaluation Report ---")
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
        print("\nFINAL VERDICT: CONTENT IS ULTRA PREMIUM (FAANG+ Level)")
    else:
        print("\nFINAL VERDICT: CONTENT NEEDS ENRICHMENT")

if __name__ == '__main__':
    main()
