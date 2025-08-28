import csv
from collections import defaultdict
from urllib.parse import urlparse

def analyze_csv(csv_file_path):
    # Sinks to exclude from processing
    excluded_sinks = {
        "JSON.parse", "document.cookie",
        "localStorage.setItem", "localStorage.getItem", "localStorage.removeItem"
    }

    # Structure to hold count of sources per sink
    sink_source_counts = defaultdict(lambda: defaultdict(int))

    # For website and webpage counts
    sink_to_websites = defaultdict(set)
    sink_to_pages = defaultdict(set)
    all_websites = set()
    all_pages = set()
    sink_to_scripts = defaultdict(set)

    with open(csv_file_path, newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)  # Skip header

        for row in reader:
            if len(row) < 5:
                continue

            source = row[0].strip()
            sink = row[1].strip()
            url = row[4].strip()
            script_file = row[3].strip()

            # Skip rows with excluded sinks
            if sink in excluded_sinks:
                continue

            # Update source count per sink
            sink_source_counts[sink][source] += 1

            # Parse and track website & page
            parsed = urlparse(url)
            domain = parsed.netloc
            full_url = url

            if domain:
                sink_to_websites[sink].add(domain)
                all_websites.add(domain)

            if full_url:
                sink_to_pages[sink].add(full_url)
                all_pages.add(full_url)

            if script_file:
                sink_to_scripts[sink].add(script_file)

    return {
        "sink_to_scripts": sink_to_scripts,
        "sink_source_counts": sink_source_counts,
        "sink_to_websites": sink_to_websites,
        "sink_to_pages": sink_to_pages,
        "total_unique_websites": len(all_websites),
        "total_unique_pages": len(all_pages),
    }

# Run analysis
file_path = 'dom-project-GoogleSheet.csv'
result = analyze_csv(file_path)

# Print source counts per sink
print("\nSource counts per Sink (excluding specific sinks):\n")
for sink, sources in result["sink_source_counts"].items():
    print(f"{sink}:")
    for source, count in sources.items():
        print(f"  {source}: {count}")

# Print site/page counts per sink
print("\nWebsite & Webpage counts per Sink:\n")
for sink in result["sink_to_websites"]:
    num_sites = len(result["sink_to_websites"][sink])
    num_pages = len(result["sink_to_pages"][sink])
    print(f"{sink}: {num_sites} websites, {num_pages} web pages")


# Print script counts per sink
print("\nscripts for each sink\n")
for sink in result["sink_to_scripts"]:
    num_scripts = len(result["sink_to_scripts"][sink])
    print(f"{sink}: {num_scripts} scripts")

# Print totals
print("\nOverall totals (excluding filtered sinks):")
print(f"Total unique websites: {result['total_unique_websites']}")
print(f"Total unique web pages: {result['total_unique_pages']}")

