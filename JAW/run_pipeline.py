# -*- coding: utf-8 -*-

"""
        Copyright (C) 2022  Soheil Khodayari, CISPA
        This program is free software: you can redistribute it and/or modify
        it under the terms of the GNU Affero General Public License as published by
        the Free Software Foundation, either version 3 of the License, or
        (at your option) any later version.
        This program is distributed in the hope that it will be useful,
        but WITHOUT ANY WARRANTY; without even the implied warranty of
        MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
        GNU Affero General Public License for more details.
        You should have received a copy of the GNU Affero General Public License
        along with this program.  If not, see <http://www.gnu.org/licenses/>.


        Description:
        ------------
        The main program that runs the testing pipeline


        Usage:
        ------------
        $ python3 -m run_pipeline --conf=config.yaml

"""

import argparse
import pandas as pd
import os, sys
import requests
import json
import csv
import random

import utils.io as IOModule
from utils.logging import logger as LOGGER
import utils.utility as utilityModule
import constants as constantsModule
import analyses.domclobbering.domc_neo4j_traversals as DOMCTraversalsModule
import analyses.domclobbering.static_analysis_api as domc_sast_model_construction_api

import analyses.cs_csrf.cs_csrf_neo4j_traversals as CSRFTraversalsModule
import analyses.cs_csrf.static_analysis_api as csrf_sast_model_construction_api

import analyses.request_hijacking.static_analysis_api as rh_sast_model_construction_api
import analyses.request_hijacking.static_analysis_py_api as request_hijacking_neo4j_analysis_api
import analyses.request_hijacking.verification_api as request_hijacking_verification_api

import analyses.dom_selectors.static_analysis_api as sast_model_construction_api
import analyses.dom_selectors.selectors_neo4j_traversals as dom_selectors_neo4j_analysis_api


import re

def sanitize_filename(name):
    # Remove or replace problematic characters
    return re.sub(r'[^a-zA-Z0-9._-]', '_', name)

def is_website_up(uri):
    try:
        response = requests.head(uri, timeout=20)
        return True
    except Exception as e:
        return False


def save_website_is_down(domain):
    base = constantsModule.DATA_DIR_UNREPONSIVE_DOMAINS
    if not os.path.exists(base):
        os.makedirs(base)

    filename = os.path.join(base, utilityModule.getDirectoryNameFromURL(domain))
    with open(filename, "w+") as fd:
        fd.write(domain)


def load_url_list(file_path, start_idx, end_idx):
    column_data = []

    with open(file_path, 'r') as file:
        csv_reader = csv.reader(file)

        for i, row in enumerate(csv_reader):
            if i > end_idx:  # Stop when end_idx is reached
                break
            if i >= start_idx:  # Start adding values after reaching start_idx
                url = row[1].strip()
                url = 'http://' + url
                column_data.append(url)

    return column_data


def crawl_for_single_url(website_url, domain_health_check, crawling_command, crawler_command_cwd, crawling_timeout):
    if domain_health_check:
        LOGGER.info('checking if domain is up with python requests ...')
        website_up = False

        try:
            website_up = is_website_up(website_url)
        except:
            save_website_is_down(website_url)
            return

        if not website_up:
            LOGGER.warning('domain %s is not up, skipping!'%website_url)
            save_website_is_down(website_url)
            return


    LOGGER.info("crawling %s"%(website_url))
    cmd = crawling_command.replace('SEED_URL', website_url)
    IOModule.run_os_command(cmd, cwd=crawler_command_cwd, timeout= crawling_timeout)
    LOGGER.info("successfully crawled %s"%(website_url))


def generate_random_subdirs_map(root_path=constantsModule.DATA_DIR, output_json_path=os.path.join(constantsModule.BASE_DIR, "random_sitelist_10_pages.json"), max_subdirs=10):
    result = {}

    # Get all subdirectories in the root_path (depth = 1)
    top_level_dirs = [d for d in os.listdir(root_path) if os.path.isdir(os.path.join(root_path, d))]

    for dir_name in top_level_dirs:
        dir_path = os.path.join(root_path, dir_name)
        
        # Get subdirectories of the current top-level directory
        subdirs = [d for d in os.listdir(dir_path) if os.path.isdir(os.path.join(dir_path, d))]

        # Select up to max_subdirs randomly
        selected_subdirs = random.sample(subdirs, min(len(subdirs), max_subdirs))
        
        # Store in result dictionary
        result[dir_name] = selected_subdirs

    # Write the result dictionary to a JSON file
    with open(output_json_path, 'w') as f:
        json.dump(result, f, indent=4)
        

def main():

    BASE_DIR= os.path.dirname(os.path.realpath(__file__))
    CONFIG_FILE_DEFAULT = 'config.yaml'
    p = argparse.ArgumentParser(description='This script runs the tool pipeline.')
    p.add_argument('--conf', "-C",
                                    metavar="FILE",
                                    default=CONFIG_FILE_DEFAULT,
                                    help='pipeline configuration file. (default: %(default)s)',
                                    type=str)


    p.add_argument('--site', "-S",
                                    default='None',
                                    help='website to test; overrides config file (default: %(default)s)',
                                    type=str)

    p.add_argument('--list', "-L",
                                    default='None',
                                    help='site list to test; overrides config file (default: %(default)s)',
                                    type=str)


    p.add_argument('--from', "-F",
                                    default=-1,
                                    help='the first entry to consider when a site list is provided; overrides config file (default: %(default)s)',
                                    type=int)

    p.add_argument('--to', "-T",
                                    default=-1,
                                    help='the last entry to consider when a site list is provided; overrides config file (default: %(default)s)',
                                    type=int)

    p.add_argument('--crawl_list', default='None', help='website to be crawled; overrides config file (default: %(default)s)', type=str)



    args= vars(p.parse_args())
    config = IOModule.load_config_yaml(args["conf"])

    override_site = args["site"]
    override_site_list = args["list"]
    override_site_list_from = args["from"]
    override_site_list_to = args["to"]
    override_crawl_list = args["crawl_list"]

    domain_health_check = config["crawler"]["domain_health_check"]

    if override_site != 'None':
        config["testbed"]["site"] = override_site

    if override_site_list != 'None':
        config["testbed"]["sitelist"] = override_site_list

    if override_site_list_from != -1:
        config["testbed"]["from_row"] = override_site_list_from

    if override_site_list_to != -1:
        config["testbed"]["to_row"] = override_site_list_to

    if override_crawl_list != 'None':
        config["crawler"]["crawl_list"] = override_crawl_list


    LOGGER.info("loading config: %s"%str(config))

    # iteratively write the HPG construction output to disk
    # useful in case of timeouts for partial results
    iterative_output = 'false'
    if "staticpass" in config:
        if "iterativeoutput" in config["staticpass"]:
            iterative_output = str(config["staticpass"]["iterativeoutput"]).lower()


    crawler_command_cwd = os.path.join(BASE_DIR, "crawler")
    force_execution_command_cwd = os.path.join(BASE_DIR, "dynamic")
    dynamic_verifier_command_cwd = os.path.join(BASE_DIR, "verifier")

    # default memory for nodejs crawling process
    crawler_node_memory = 8192

    if "memory" in config["crawler"]:
        crawler_node_memory = config["crawler"]["memory"]

    # crawling
    crawling_command = "node --max-old-space-size={5} DRIVER_ENTRY --seedurl=SEED_URL --maxurls={0} --browser={1} --headless={2} --overwrite={3} --foxhound={4}".format(
            config["crawler"]["maxurls"],
            config["crawler"]["browser"]["name"],
            config["crawler"]["browser"]["headless"],
            config["crawler"]["overwrite"],
            config["crawler"]["browser"]["foxhound"], # should_use_foxhound
            crawler_node_memory
    )


    browser_name = config["crawler"]["browser"]["name"]
    if browser_name == 'chrome':
        crawler_js_program = 'crawler.js'
    else:
        crawler_js_program = 'crawler-taint.js'



    node_crawler_driver_program = os.path.join(crawler_command_cwd, crawler_js_program)
    crawling_command = crawling_command.replace("DRIVER_ENTRY", node_crawler_driver_program)
    crawling_timeout = int(config["crawler"]["sitetimeout"])


    # static analysis config
    static_analysis_timeout = int(config["staticpass"]["sitetimeout"])
    static_analysis_memory = config["staticpass"]["memory"]
    static_analysis_per_webpage_timeout = int(config["staticpass"]["pagetimeout"])

    static_analysis_compress_hpg = 'true'
    if "compress_hpg" in config["staticpass"]:
        static_analysis_compress_hpg = config["staticpass"]["compress_hpg"]


    static_analysis_overwrite_hpg = 'false'
    if "overwrite_hpg" in config["staticpass"]:
        static_analysis_overwrite_hpg = config["staticpass"]["overwrite_hpg"]

    # set neo4j config
    if "neo4j_user" in config["staticpass"]:
        constantsModule.NEO4J_USER = config["staticpass"]["neo4j_user"]
        constantsModule.NEOMODEL_NEO4J_CONN_STRING = "bolt://%s:%s@127.0.0.1:%s"%(constantsModule.NEO4J_USER, constantsModule.NEO4J_PASS, constantsModule.NEO4J_BOLT_PORT)

    if "neo4j_pass" in config["staticpass"]:
        constantsModule.NEO4J_PASS = config["staticpass"]["neo4j_pass"]
        constantsModule.NEOMODEL_NEO4J_CONN_STRING = "bolt://%s:%s@127.0.0.1:%s"%(constantsModule.NEO4J_USER, constantsModule.NEO4J_PASS, constantsModule.NEO4J_BOLT_PORT)

    if "neo4j_http_port" in config["staticpass"]:
        constantsModule.NEO4J_HTTP_PORT = config["staticpass"]["neo4j_http_port"]
        constantsModule.NEO4J_CONN_HTTP_STRING = "http://127.0.0.1:%s"%str(constantsModule.NEO4J_HTTP_PORT)

    if "neo4j_bolt_port" in config["staticpass"]:
        constantsModule.NEO4J_BOLT_PORT = config["staticpass"]["neo4j_bolt_port"]
        constantsModule.NEO4J_CONN_STRING = "bolt://127.0.0.1:%s"%str(constantsModule.NEO4J_BOLT_PORT)
        constantsModule.NEOMODEL_NEO4J_CONN_STRING = "bolt://%s:%s@127.0.0.1:%s"%(constantsModule.NEO4J_USER, constantsModule.NEO4J_PASS, constantsModule.NEO4J_BOLT_PORT)

    if "neo4j_use_docker" in config["staticpass"]:
        constantsModule.NEO4J_USE_DOCKER = config["staticpass"]["neo4j_use_docker"]





    if config['dom_selectors']['enabled']:

        #crawling
        if config['dom_selectors']["passes"]["crawling"]:
            # urls_list = load_url_list(constantsModule.TRANCO_FILE_PATH, config['crawler']["start_idx"], config['crawler']["end_idx"]) 
            urls_list = load_url_list(config["crawler"]["crawl_list"], config['crawler']["start_idx"], config['crawler']["end_idx"])
            for website_url in urls_list:
                crawl_for_single_url(website_url, domain_health_check, crawling_command, crawler_command_cwd, crawling_timeout)

            LOGGER.info("Crawling is finished.")
        
            # random sampling (10 random pages per website)
            generate_random_subdirs_map()


        # Start analyzing pages determined in the sitelist file
        testbed_filename = os.path.join(BASE_DIR, config["testbed"]["sitelist"].strip())
        from_row = int(config["testbed"]["from_row"])
        to_row = int(config["testbed"]["to_row"])

        with open(testbed_filename, "r") as f:
            sample_data = json.load(f)                  # contains website's folder name and its respective list of chosen webpages that should be analysed.

        sample_data_list = []

        for website_folder_name, top_hashes in sample_data.items():
            sample_data_dict = {
                    "website_folder_name": sanitize_filename(website_folder_name),
                    "top_hashes_list": top_hashes
            }
            sample_data_list.append(sample_data_dict)

        desired_websites = sample_data_list[from_row : to_row]

        # Looping over key-value pairs in the top_hashes_data dictionary
        for obj in desired_websites:
            # static analysis
            if config['dom_selectors']["passes"]["static"]:
                LOGGER.info("static analysis for site %s"%(obj["website_folder_name"]))
                sast_model_construction_api.start_model_construction(website_folder_name=obj["website_folder_name"], memory=static_analysis_memory, timeout=static_analysis_per_webpage_timeout, compress_hpg=static_analysis_compress_hpg, overwrite_hpg=static_analysis_overwrite_hpg, top_hashes_list=obj["top_hashes_list"])
                LOGGER.info("successfully finished static analysis for site %s"%(obj["website_folder_name"]))

            if config['dom_selectors']["passes"]["static_neo4j_sources"]:
                LOGGER.info("HPG construction and analysis over neo4j for site %s"%(obj["website_folder_name"]))
                do_sink_analysis = config['dom_selectors']["passes"]["static_neo4j_sinks"]
                do_source_analysis = config['dom_selectors']["passes"]["static_neo4j_sources"]
                dom_selectors_neo4j_analysis_api.build_and_analyze_hpg(website_folder_name=obj["website_folder_name"], top_hashes_list=obj["top_hashes_list"], do_sink_analysis=do_sink_analysis, do_source_analysis=do_source_analysis, timeout=static_analysis_per_webpage_timeout, overwrite=static_analysis_overwrite_hpg, is_test=config['dom_selectors']['is_test'], should_change_delimiter=config['dom_selectors']['should_change_delimiter'])
                LOGGER.info("finished HPG construction and analysis over neo4j for site %s"%(website_folder_name))



if __name__ == "__main__":
    main()
