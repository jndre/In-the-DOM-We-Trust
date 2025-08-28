import os
import json
import csv
from collections import Counter, defaultdict, deque
import re



def filter_objects_with_data_flow(flow):
    def parse_assignments(code):
        """
        Parse all variable assignments in a code snippet.
        Returns a list of (variable, value) pairs.
        """
        # Match variable assignments (e.g., `a = b`, `var x = y`, or `let z = w`)
        assignments = re.findall(r'(\w+)\s*=\s*([^,;]+)', code)
        results = []
        for var, value in assignments:
            # Extract all base variables (e.g., `hey` from `hey.i` or `hey[i]`)
            base_vars = re.findall(r'\b\w+\b', value)
            results.append((var, value, base_vars))
        return results

    def build_dependency_graph(code_snippets):
        """
        Build a dependency graph from code snippets.
        Each variable points to its value or dependency.
        """
        dependency_graph = defaultdict(list)
        for code in reversed(code_snippets):  # Process in logical order
            for var, value, base_vars in parse_assignments(code):
                dependency_graph[var].append(value)
                for bv in base_vars:
                    dependency_graph[var].append(bv)

        return dependency_graph

    def trace_to_api(dependency_graph, candidate_variable):
        """
        Trace whether a candidate variable has a dependency on a query selector API.
        """
        visited = set()
        queue = deque([candidate_variable])
        query_apis = {"querySelector", "querySelectorAll",
                      "getElementsByTagName", "getElementsByClassName",
                      "getElementById"}

        while queue:
            var = queue.popleft()
            if var in visited:
                continue
            visited.add(var)

            # Check direct dependencies
            for dependency in dependency_graph.get(var, []):
                if any(api in dependency for api in query_apis):
                    return True
                # Add further dependencies to the queue
                if dependency.isidentifier():  # It's a variable, not a literal
                    queue.append(dependency)

        return False

    def analyze_candidate_variables(program_slices):
        """
        Analyze all candidate variables to check if they have valid data flow.
        """
        valid_candidates = []
        for var, details in program_slices.items():
            semantic_types = details.get('semantic_types', [])
            if all(st == "NON_REACH" for st in semantic_types):
                continue  # Skip NON_REACH only variables

            slices = details.get('slices', [])
            code_snippets = [slice_obj.get('code', '') for slice_obj in slices]

            # Build the dependency graph and trace data flow
            dependency_graph = build_dependency_graph(code_snippets)
            if trace_to_api(dependency_graph, var):
                valid_candidates.append(var)

        return valid_candidates

    def filter_based_on_sink_code(sink_code, program_slices):
        """
        Additional filtering based on sink_code containing $(this).
        """
        if "$(this)" in sink_code:
            if all(all(st == "NON_REACH" for st in details.get('semantic_types', []))
                   for details in program_slices.values()):
                return True
        return False

    # Main filtering process
    should_be_filtered = False


    program_slices = flow.get("program_slices", {})
    sink_code = flow.get("sink_code", "")

        # Analyze candidate variables
    valid_candidates = analyze_candidate_variables(program_slices)

        # Apply sink_code-based filtering
    if filter_based_on_sink_code(sink_code, program_slices):
        should_be_filtered = True

        # Exclude the object if no valid candidates exist
    if not valid_candidates:
        should_be_filtered = True


    return should_be_filtered


# Define the directory paths and search criteria
result_dir = "/home/sepehr/markupinjection/domproject_large_scale/result"
data_dir = "/home/dklein/domproject/data/data"
output_csv = "StaticAnalysis.csv"

# List of semantic types to check for
semantic_type_criteria = {
    "GET_ELEMENT_BY_ID", "GET_ELEMENTS_BY_CLASS_NAME", 
    "GET_ELEMENTS_BY_TAG_NAME", "QUERY_SELECTOR", "JQUERY"
}

# Function to read the URL from url.out file
def get_url(website_dir, webpage_dir):
    url_file_path = os.path.join(data_dir, website_dir, webpage_dir, "url.out")
    try:
        with open(url_file_path, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"URL file not found for {website_dir}/{webpage_dir}")
        return None

# Prepare to write to the CSV file
with open(output_csv, mode="w", newline="") as csv_file:
    csv_writer = csv.writer(csv_file)
    # Write the header row
    csv_writer.writerow(["Source", "Sink", "JS_file", "url", "DataflowCount"])

    # Initialize a counter for processed websites
    processed_websites = 0

    # Walk through each website directory
    for website in os.listdir(result_dir):
        website_path = os.path.join(result_dir, website)
        if not os.path.isdir(website_path):
            continue

        # Increment and check the processed websites counter
        processed_websites += 1
        if processed_websites % 50 == 0:
            print(f"Processed {processed_websites} websites...")

        # For each webpage directory in the website directory
        for webpage in os.listdir(website_path):
            webpage_path = os.path.join(website_path, webpage)
            if not os.path.isdir(webpage_path):
                continue

            # Path to the "sinks.flows.out.json" file
            sinks_flows_file = os.path.join(webpage_path, "sinks.flows.out.json")
            if not os.path.isfile(sinks_flows_file):
                continue

            # Dictionary to store (Source, Sink, JS_file) combinations with counts
            dataflow_counter = Counter()

            # Read and process the "sinks.flows.out.json" file
            with open(sinks_flows_file, "r") as json_file:
                data = json.load(json_file)

                # Check for the "flows" key and process each flow object
                flows = data.get("flows", [])
                for flow in flows:
                    semantic_types = flow.get("semantic_types", [])
                    matched_strings = [
                        st for st in semantic_types if st in semantic_type_criteria
                    ]

                    # If there are matching semantic types, record the data
                    if matched_strings and not filter_objects_with_data_flow(flow):
                        for matched_string in matched_strings:
                            sink_type = flow.get("sink_type", "")
                            js_file = flow.get("JS_file", "")
                            # Count occurrences of each unique (Source, Sink, JS_file) combination
                            dataflow_counter[(matched_string, sink_type, js_file)] += 1

            # Retrieve the URL for the webpage
            url = get_url(website, webpage)

            # Write unique (Source, Sink, JS_file) records with counts to the CSV file
            if url:
                for (source, sink, js_file), count in dataflow_counter.items():
                    csv_writer.writerow([source, sink, js_file, url, count])

print(f"Data extraction complete. Results saved to {output_csv}")

