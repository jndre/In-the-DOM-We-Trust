import os
import random
import json


counter = 0

def pick_random_webpages(root_dir, max_count=10):
    global counter
    result = {}

    for website_dir in os.listdir(root_dir):
        website_path = os.path.join(root_dir, website_dir)

        if os.path.isdir(website_path):
            webpages = [name for name in os.listdir(website_path) if os.path.isdir(os.path.join(website_path, name))]
            random_webpages = random.sample(webpages, min(max_count, len(webpages)))

            result[website_dir] = random_webpages

            if len(webpages) < 3:
                counter += 1

    return result

def main():
    global counter
    input_directory = "../new_data"
    output_filename = "new_data_3random_webpages_list.json"
    max_webpages_per_site = 3

    random_webpages = pick_random_webpages(input_directory, max_webpages_per_site)

    with open(output_filename, 'w') as output_file:
        json.dump(random_webpages, output_file, indent=4)

    print(f"Results saved in {output_filename}")
    print(counter)

if __name__ == "__main__":
    main()
