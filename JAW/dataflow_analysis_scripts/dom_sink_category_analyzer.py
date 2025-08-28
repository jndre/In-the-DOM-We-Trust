
import csv
from collections import defaultdict
from urllib.parse import urlparse

def analyze_csv_by_exact_category(csv_file_path):
    # Use exact sink values as provided
    SINK_CATEGORIES = {
        "Code Execution": {"eval", "document.write/writeln"},
        "Markup Injection": {"innerHTML/outerHTML", "insertAdjacentHTML", "$(selector).ManipulateDOM"},
        "Request Hijacking": {"fetch", "XMLHttpRequest.open/setRequestHeader"},
        "Navigation": {"window.open", "window/document.location", "window/document.location.(assign/replace)"},
        "Object and link": {
            "someElement.src/href",
            "window/document.location.(href/search/hash/port/pathname/protocol)",
            "someElement.setAttribute",
            "location.(href/search/hash/port/pathname/protocol)"
        }
    }

    # Track websites and pages by category
    category_sites = defaultdict(set)
    category_pages = defaultdict(set)

    with open(csv_file_path, newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)

        for row in reader:
            if len(row) < 5:
                continue

            sink = row[1].strip()
            url = row[4].strip()
            parsed = urlparse(url)
            domain = parsed.netloc
            full_url = url

            if sink and domain and full_url:
                # Match exact sink to category
                for category, sink_set in SINK_CATEGORIES.items():
                    if sink in sink_set:
                        category_sites[category].add(domain)
                        category_pages[category].add(full_url)
                        break

    # Output results
    print("\n📊 Website & Webpage counts by Exact Sink Categories:\n")
    for category in SINK_CATEGORIES:
        site_count = len(category_sites[category])
        page_count = len(category_pages[category])
        print(f"{category}: {site_count} websites, {page_count} pages")

# Example usage
file_path = 'dom-project-GoogleSheet.csv'
analyze_csv_by_exact_category(file_path)

