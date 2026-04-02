import sys
import os
import json
import re
import shutil

REPO_ROOT = "/Users/211446/Grokking-System-Design/tmp_primer"
README_PATH = os.path.join(REPO_ROOT, "README.md")
CHAPTERS_DIR = "/Users/211446/Grokking-System-Design/course-content/chapters"
WEBSITE_IMG_DIR = "/Users/211446/Grokking-System-Design/course-website/public/images/primer"

SECTION_MAPPING = {
    "Performance vs scalability": "ch02_distributed_systems.json",
    "Latency vs throughput": "ch02_distributed_systems.json",
    "Availability vs consistency": "ch09_cap_consensus.json",
    "Consistency patterns": "ch09_cap_consensus.json",
    "Availability patterns": "ch09_cap_consensus.json",
    "Domain name system": "ch03_networking.json",
    "Content delivery network": "ch07_caching.json",
    "Load balancer": "ch04_load_balancing.json",
    "Reverse proxy (web server)": "ch04_load_balancing.json",
    "Application layer": "ch15_service_discovery.json",
    "Database": "ch05_databases.json",
    "Cache": "ch07_caching.json",
    "Asynchronism": "ch10_message_queues.json",
    "Communication": "ch03_networking.json",
    "Security": "ch18_security.json"
}

def ensure_dirs():
    os.makedirs(WEBSITE_IMG_DIR, exist_ok=True)

def resolve_chapter_path(filename):
    if filename == "ch18_security.json":
        path = os.path.join(CHAPTERS_DIR, filename)
        if not os.path.exists(path):
            with open(path, "w") as f:
                json.dump({
                    "id": "ch18",
                    "title": "Security",
                    "tags": ["security"],
                    "summary": "System Design Security Fundamentals",
                    "explanation": {"overview": ""}
                }, f, indent=4)
        return path
    return os.path.join(CHAPTERS_DIR, filename)

def parse_readme():
    with open(README_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    sections = re.split(r'\n## ', '\n' + content)
    updates = {}
    for section in sections:
        if not section.strip(): continue
        lines = section.split('\n', 1)
        title = lines[0].strip()
        body = lines[1] if len(lines) > 1 else ""
        if title in SECTION_MAPPING:
            target_json = SECTION_MAPPING[title]
            if target_json not in updates: updates[target_json] = []
            updates[target_json].append((title, body))
    return updates

def process_images_in_body(body):
    img_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    def replace_image(match):
        alt = match.group(1)
        src = match.group(2)
        if src.startswith("images/"):
            filename = os.path.basename(src)
            source_path = os.path.join(REPO_ROOT, src)
            target_path = os.path.join(WEBSITE_IMG_DIR, filename)
            if os.path.exists(source_path):
                shutil.copy2(source_path, target_path)
            return f'![{alt}](/images/primer/{filename})'
        return match.group(0)
    return re.sub(img_pattern, replace_image, body)

def update_chapter(filepath, new_sections):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "explanation" not in data: data["explanation"] = {}
    
    # Remove primer_notes from previous run
    data["explanation"].pop("primer_notes", None)

    overview = data["explanation"].get("overview", "")
    
    # Remove previously appended primer content if any
    marker = "\n\n<!-- PRIMER CONTENT -->\n"
    if marker in overview:
        overview = overview.split(marker)[0]

    appended_content = marker
    for title, body in new_sections:
        processed_body = process_images_in_body(body)
        appended_content += f"\n## {title}\n{processed_body}\n"

    data["explanation"]["overview"] = overview + appended_content

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    print(f"Inlined {len(new_sections)} primer sections into {filepath}.")

if __name__ == "__main__":
    ensure_dirs()
    updates = parse_readme()
    for filename, sections in updates.items():
        filepath = resolve_chapter_path(filename)
        update_chapter(filepath, sections)
    print("Success: Synchronized primer content directly into overview.")
