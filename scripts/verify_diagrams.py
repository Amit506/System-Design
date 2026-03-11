import json
import glob
import sys
import re

def verify_diagrams():
    print("🔍 Starting Comprehensive Diagram Verification Loop...")
    files = glob.glob('/Users/211446/Grokking-System-Design/course-content/**/*.json', recursive=True)
    all_valid = True
    total_diagrams = 0
    high_quality_diagrams = 0
    
    for f in files:
        if 'schema.json' in f or 'index.json' in f:
            continue
            
        try:
            with open(f, 'r') as file:
                data = json.load(file)
                
            if 'diagram' in data:
                total_diagrams += 1
                diag = data['diagram']
                
                # Check 1: Must be Mermaid
                if diag.get('type') != 'mermaid':
                    print(f"❌ [FORMAT ERROR] {f}: Diagram must be 'mermaid', found '{diag.get('type')}'.")
                    all_valid = False
                    continue
                
                source = diag.get('data', {}).get('mermaid_source', '')
                
                # Check 2: Exists
                if not source:
                    print(f"❌ [DATA ERROR] {f}: Missing 'mermaid_source' string.")
                    all_valid = False
                    continue
                    
                # Check 3: Valid Mermaid Initialization
                valid_starts = ['graph ', 'flowchart ', 'sequenceDiagram', 'classDiagram', 'stateDiagram']
                if not any(source.strip().startswith(s) for s in valid_starts):
                    print(f"❌ [SYNTAX ERROR] {f}: Invalid mermaid syntax initialization. Must start with graph/flowchart/etc.")
                    all_valid = False
                    continue
                    
                # Check 4: Premium Quality Metrics (nodes, styling, length)
                is_graph = 'graph' in source or 'flowchart' in source
                if len(source) > 150:
                    if is_graph and ('-->' in source or '-.' in source) and ('[' in source):
                        high_quality_diagrams += 1
                    elif not is_graph and ('->' in source or '<|' in source or 'participant' in source or 'class ' in source or 'stateDiagram' in source):
                        high_quality_diagrams += 1
                    else:
                        print(f"⚠️ [WARNING] {f}: Diagram lacks complexity. Consider adding more edges.")
                else:
                    print(f"⚠️ [WARNING] {f}: Diagram lacks complexity. Consider adding more nodes, styles, or relationships.")
                
        except Exception as e:
            print(f"❌ [FATAL ERROR] Failed to parse {f}: {e}")
            all_valid = False
            
    print("-" * 50)
    if all_valid:
        print(f"✅ VERIFICATION LOOP SUCCESS: All {total_diagrams} diagrams are valid Premium Mermaid format.")
        print(f"🌟 {high_quality_diagrams}/{total_diagrams} diagrams meet the 'Ultra-Premium' complexity threshold.")
        sys.exit(0)
    else:
        print("❌ VERIFICATION LOOP FAILED. Please fix the above diagram errors.")
        sys.exit(1)

if __name__ == '__main__':
    verify_diagrams()
