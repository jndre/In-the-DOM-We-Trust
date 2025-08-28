import os
import csv
import json
import random
from collections import defaultdict
from pathlib import Path

# Constants
CSV_FILE = "StaticAnalysis_with_filters.csv"  # CSV is in same directory as script
RESULT_ROOT = "/home/sepehr/markupinjection/domproject_large_scale/result"
OUTPUT_DIR = "sink_sampling_results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# List of targeted sink types
TARGET_SINKS = {
    "someElement.src/href",
    "innerHTML/outerHTML",
    "window/document.location.(href/search/hash/port/pathname/protocol)",
    "insertAdjacentHTML",
    "someElement.setAttribute",
    "fetch",
    "$(selector).ManipulateDOM",
    "eval",
    "location.(href/search/hash/port/pathname/protocol)",
    "window/document.location.(assign/replace)",
    "window.open",
    "window/document.location",
    "XMLHttpRequest.open/setRequestHeader",
    "document.write/writeln"
}

# Read the CSV and group rows by sink type
sink_groups = defaultdict(list)

with open(CSV_FILE, newline='') as csvfile:
    reader = csv.reader(csvfile)
    for row in reader:
        if len(row) < 5:
            continue
        sink = row[1].strip()
        loc = row[2].strip()
        js_file = row[3].strip()
        url = row[4].strip()

        if sink not in TARGET_SINKS:
            continue

        sink_groups[sink].append({
            "sink": sink,
            "loc": loc,
            "JS_file": js_file,
            "url": url
        })

# Global tracking of used domains and pages
used_domains = set()
used_pages = set()

# Sampling logic with global domain and page tracking
def sample_rows(rows, used_domains, used_pages):
    domain_map = defaultdict(list)
    page_map = defaultdict(list)

    for row in rows:
        js_path = row["JS_file"]
        if not js_path or not js_path.startswith("/dklein/"):
            continue
        parts = Path(js_path).parts
        if len(parts) < 4:
            continue
        domain = parts[2]
        page = parts[3]
        domain_map[domain].append(row)
        page_map[(domain, page)].append(row)

    # Sampling: First, pick unique domains not yet used for any sink
    samples = []
    for domain, domain_rows in domain_map.items():
        if domain not in used_domains:
            sample = random.choice(domain_rows)
            samples.append(sample)
            used_domains.add(domain)

    # If less than 200, pick unique pages
    if len(samples) < 200:
        remaining = 200 - len(samples)
        for (domain, page), page_rows in page_map.items():
            if (domain, page) not in used_pages:
                sample = random.choice(page_rows)
                samples.append(sample)
                used_pages.add((domain, page))
            if len(samples) >= 200:
                break

    # If still not enough, pick remaining randomly
    if len(samples) < 200:
        remaining_rows = [r for r in rows if r not in samples]
        random.shuffle(remaining_rows)
        samples += remaining_rows[:200 - len(samples)]

    return samples[:200]

# Convert JS_file path to JSON path
def get_json_path(js_file):
    if not js_file.startswith("/dklein/"):
        return None
    rel_path = js_file.replace("/dklein/", "")
    parts = Path(rel_path).parts
    if len(parts) < 3:
        return None
    return os.path.join(RESULT_ROOT, *parts[:-1], "sinks.flows.out.json")

# Main collection logic
for sink, rows in sink_groups.items():
    sampled = sample_rows(rows, used_domains, used_pages)
    collected = []
    seen_keys = set()
    index = 1

    for row in sampled:
        json_path = get_json_path(row["JS_file"])
        if not json_path or not os.path.exists(json_path):
            continue

        try:
            with open(json_path) as f:
                data = json.load(f)
        except Exception:
            continue

        for flow in data.get("flows", []):
            if flow.get("loc") != row["loc"]:
                continue

            sink_code = flow.get("sink_code", "")
            slices_json = json.dumps(flow.get("program_slices", {}), sort_keys=True)
            key = (sink_code, slices_json)

            if key in seen_keys:
                continue

            flow["_index"] = index
            flow["_source_url"] = row["url"]  # Add URL from CSV row
            collected.append(flow)
            seen_keys.add(key)
            index += 1

    if collected:
        safe_sink = sink.replace("/", "_").replace("(", "").replace(")", "").replace(".", "_")
        out_file = os.path.join(OUTPUT_DIR, f"{safe_sink}.json")
        with open(out_file, "w") as f:
            json.dump(collected, f, indent=2)

print("✅ Extraction complete. Output written to:", OUTPUT_DIR)
