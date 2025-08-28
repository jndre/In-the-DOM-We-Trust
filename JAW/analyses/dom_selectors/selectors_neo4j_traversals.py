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
        Detecting request hijacking vulnerabilities


        Usage:
        ------------
        > import analyses.request_hijacking.static_analysis_py_api as request_hijacking_py_api

"""


import os
import sys
import time
import json
import csv
import constants as constantsModule
import utils.io as IOModule
import docker.neo4j.manage_container as dockerModule
import hpg_neo4j.db_utility as DU
import hpg_neo4j.query_utility as QU
import analyses.dom_selectors.traversals_cypher_sinks as dom_selectors_py_sink_traversals
import analyses.dom_selectors.traversals_cypher_sources as dom_selectors_py_source_traversals
from utils.logging import logger as LOGGER


def log_execution_duration(start_time, end_time, operation_type):
    seconds_in_minute = 60
    seconds_in_hour = 3600
    seconds_in_day = 86400

    elapsed_time_seconds = end_time - start_time

    days = int(elapsed_time_seconds // seconds_in_day)
    hours = int((elapsed_time_seconds % seconds_in_day) // seconds_in_hour)
    minutes = int((elapsed_time_seconds % seconds_in_hour) // seconds_in_minute)

    # Log the runtime
    LOGGER.info(f"{operation_type} Runtime: {days} days, {hours} hours, {minutes} minutes.")

def change_csv_delimiter(source_file, destination_file):
    # Define the source delimiter
    source_delimiter = '¿'

    # Define the unique ASCII delimiter
    new_delimiter = '~'

    csv.field_size_limit(5000000)

    try:
        # Open the source CSV file for reading with the appropriate encoding
        with open(source_file, 'r', encoding='utf-8') as source:
            # Read the CSV data
            csv_reader = csv.reader(source, delimiter=source_delimiter)
            data = [row for row in csv_reader]

        # Open the destination CSV file for writing
        with open(destination_file, 'w', newline='', encoding='utf-8') as destination:
            # Write the modified CSV data with the new delimiter
            csv_writer = csv.writer(destination, delimiter=new_delimiter)
            csv_writer.writerows(data)

    except csv.Error as e:
        print("Error occurred while processing CSV file:", e)


def get_url_for_webpage(webpage_directory):
    content = None
    fd = open(os.path.join(webpage_directory, "url.out"), "r")
    content = fd.read()
    fd.close()
    return content


def get_name_from_url(url):

    """
     @param url: eTLD+1 domain name
     @return converts the url to a string name suitable for a directory by removing the colon and slash symbols

    """
    return url.replace(':', '-').replace('/', '')



# ------------------------------------------------------------------------------------ #
#       Interface
# ------------------------------------------------------------------------------------ #
def build_and_analyze_hpg(website_folder_name='', top_hashes_list=[], website_url='', do_sink_analysis=False, do_source_analysis=False, timeout=1800, overwrite=False, is_test=False, should_change_delimiter=False):

    """
    @param {string} seed_url
    @param {integer} timeout: per page static analysis timeout
    @description: imports an HPG inside a neo4j graph database and runs traversals over it.
    """

    if is_test:
        analyze_hpg_for_tests(do_sink_analysis=do_sink_analysis, do_source_analysis=do_source_analysis, overwrite=overwrite, conn_timeout=timeout, should_change_delimiter=should_change_delimiter)

    else:
        build_and_analyze_hpg_local(website_folder_name=website_folder_name, top_hashes_list=top_hashes_list, website_url=website_url, do_sink_analysis=do_sink_analysis, do_source_analysis=do_source_analysis, overwrite=overwrite, conn_timeout=timeout, should_change_delimiter=should_change_delimiter)



def build_and_analyze_hpg_local(website_folder_name='', top_hashes_list=[], website_url='', do_sink_analysis=False, do_source_analysis=False, overwrite=False, conn_timeout=None, should_change_delimiter=False):

    if website_url:
        website_folder_name = get_name_from_url(website_url)

    webapp_data_directory = os.path.join(constantsModule.DATA_DIR, website_folder_name)
    if not os.path.exists(webapp_data_directory):
        LOGGER.error("[TR] did not found the directory for HPG analysis: "+str(webapp_data_directory))
        return -1

    new_webapp_data_directory = os.path.join(constantsModule.RESULT_DIR, website_folder_name)
    if not os.path.exists(new_webapp_data_directory):
        os.makedirs(new_webapp_data_directory)

    if website_url and len(top_hashes_list) == 0:
        webpages_json_file = os.path.join(webapp_data_directory, "webpages.json")

        if os.path.exists(webpages_json_file):
            LOGGER.info('[TR] reading webpages.json')
            fd = open(webpages_json_file, 'r')
            webapp_pages = json.load(fd)
            fd.close()

        else:
            LOGGER.info('[TR] webpages.json does not exist; falling back to filesystem.')
            # fall back to analyzing all pages if the `webpages.json` file is missing
            webapp_pages = os.listdir(webapp_data_directory)
            # the name of each webpage folder is a hex digest of a SHA256 hash (as stored by the crawler)
            # webapp_pages = [item for item in webapp_pages if len(item) == 64]

        top_hashes_list = webapp_pages


    for webpage in top_hashes_list:
        webpage_folder = os.path.join(new_webapp_data_directory, webpage)
        if not os.path.exists(webpage_folder):
            os.makedirs(webpage_folder)

        if os.path.exists(webpage_folder):

            LOGGER.warning('[TR] HPG analyis for: %s'%(webpage_folder))

            if str(overwrite).lower() == 'false':
                # do NOT re-analyze webpages
                OUTPUT_FILE = os.path.join(webpage_folder, "sinks.flows.out")
                if os.path.exists(OUTPUT_FILE):
                    LOGGER.info('[TR] analyis results for sources already exists for webpage: %s'%webpage_folder)
                    continue

            # requirement: the database name must have a length between 3 and 63 characters
            # must always import into the default neo4j database
            neo4j_database_name = 'neo4j'

            database_name = '{0}_{1}'.format(website_folder_name, webpage)

            nodes_file = os.path.join(webpage_folder, constantsModule.NODE_INPUT_FILE_NAME)
            rels_file =  os.path.join(webpage_folder, constantsModule.RELS_INPUT_FILE_NAME)
            rels_dynamic_file = os.path.join(webpage_folder, constantsModule.RELS_DYNAMIC_INPUT_FILE_NAME)

            nodes_file_gz = os.path.join(webpage_folder, constantsModule.NODE_INPUT_FILE_NAME +'.gz')
            rels_file_gz =  os.path.join(webpage_folder, constantsModule.RELS_INPUT_FILE_NAME  +'.gz')
            rels_dynamic_file_gz = os.path.join(webpage_folder, constantsModule.RELS_DYNAMIC_INPUT_FILE_NAME  +'.gz')


            new_nodes_file = os.path.join(webpage_folder, constantsModule.NEW_DELIMITER_NODE_INPUT_FILE_NAME)
            new_rels_file =  os.path.join(webpage_folder, constantsModule.NEW_DELIMITER_RELS_INPUT_FILE_NAME)
            new_rels_dynamic_file = os.path.join(webpage_folder, constantsModule.NEW_DELIMITER_RELS_DYNAMIC_INPUT_FILE_NAME)

            new_nodes_file_gz = os.path.join(webpage_folder, constantsModule.NEW_DELIMITER_NODE_INPUT_FILE_NAME +'.gz')
            new_rels_file_gz =  os.path.join(webpage_folder, constantsModule.NEW_DELIMITER_RELS_INPUT_FILE_NAME +'.gz')
            new_rels_dynamic_file_gz = os.path.join(webpage_folder, constantsModule.NEW_DELIMITER_RELS_DYNAMIC_INPUT_FILE_NAME +'.gz')


            if os.path.exists(new_nodes_file) and os.path.exists(new_rels_file):
                should_change_delimiter = False

            elif os.path.exists(new_nodes_file_gz) and os.path.exists(new_rels_file_gz):
                LOGGER.info('[TR] de-compressing hpg.')
                # de-compress the hpg
                IOModule.decompress_graph(webpage_folder, webpage_folder, node_file=new_nodes_file, edge_file=new_rels_file, edges_file_dynamic=new_rels_dynamic_file)
                should_change_delimiter = False

            elif os.path.exists(nodes_file) and os.path.exists(rels_file):
                LOGGER.info('[TR] hpg files exist in decompressed format, skipping de-compression.')
                should_change_delimiter = True

            elif os.path.exists(nodes_file_gz) and os.path.exists(rels_file_gz):
                LOGGER.info('[TR] de-compressing hpg.')
                # de-compress the hpg
                IOModule.decompress_graph(webpage_folder, webpage_folder)
                should_change_delimiter = True

            else:
                LOGGER.error('[TR] The nodes/rels.csv files do not exist in %s, skipping.'%webpage_folder)
                continue


            ### changing the delimiter of CSV files
            if should_change_delimiter:
                change_csv_delimiter(nodes_file, new_nodes_file)
                change_csv_delimiter(rels_file, new_rels_file)
                change_csv_delimiter(rels_dynamic_file, new_rels_dynamic_file)


            neo4j_http_port = constantsModule.NEO4J_HTTP_PORT
            neo4j_bolt_port = constantsModule.NEO4J_BOLT_PORT

            LOGGER.warning('[TR] removing any previous neo4j instance for %s'%str(database_name))
            DU.ineo_remove_db_instance(database_name)

            LOGGER.info('[TR] creating db %s with http port %s'%(database_name, neo4j_http_port))
            DU.ineo_create_db_instance(database_name, neo4j_http_port)

            # check if the bolt port requested by the config.yaml is not the default one
            if not ( int(neo4j_http_port) + 2 == int(neo4j_bolt_port) ):
                LOGGER.info('[TR] setting the requested bolt port %s for db %s'%(neo4j_bolt_port, database_name))
                DU.ineo_set_bolt_port_for_db_instance(database_name, neo4j_bolt_port)

            LOGGER.info('[TR] importing the database with neo4j-admin.')
            DU.neoadmin_import_db_instance(database_name, neo4j_database_name, new_nodes_file, new_rels_file, new_rels_dynamic_file)

            LOGGER.info('[TR] changing the default neo4j password to enable programmatic access.')
            DU.ineo_set_initial_password_and_restart(database_name, password=constantsModule.NEO4J_PASS)

            # compress the hpg after the model import
            if os.path.exists(new_nodes_file) and os.path.exists(new_rels_file):
                IOModule.compress_graph(webpage_folder, node_file=new_nodes_file, edge_file=new_rels_file, edges_file_dynamic=new_rels_dynamic_file)
            if os.path.exists(nodes_file) and os.path.exists(rels_file):
                IOModule.compress_graph(webpage_folder)

            LOGGER.info('[TR] waiting for the neo4j connection to be ready...')
            time.sleep(10)
            LOGGER.info('[TR] connection: %s'%constantsModule.NEO4J_CONN_HTTP_STRING)
            connection_success = DU.wait_for_neo4j_bolt_connection(timeout=150, conn=constantsModule.NEO4J_CONN_HTTP_STRING)
            if not connection_success:
                try:
                    LOGGER.info('[TR] stopping neo4j for %s'%str(database_name))
                    DU.ineo_stop_db_instance(database_name)

                    ## remove db after analysis
                    DU.ineo_remove_db_instance(database_name)
                except:
                    LOGGER.info('[TR] ran into exception while prematurely stopping neo4j for %s'%str(database_name))
                continue

            try:
                webpage_url = get_url_for_webpage(webpage_folder)
            except:
                webpage_url = ""

            if do_sink_analysis:
                LOGGER.info('[TR] starting to run the queries for sinks.')
                try:
                    sink_start_time = time.time()
                    DU.exec_fn_within_transaction(dom_selectors_py_sink_traversals.run_traversals, webpage_url, webpage_folder, webpage, conn=constantsModule.NEO4J_CONN_STRING, conn_timeout=conn_timeout)
                    sink_end_time = time.time()
                    log_execution_duration(sink_start_time, sink_end_time, 'sink')
                except Exception as e:
                    LOGGER.error(e)
                    LOGGER.error('[TR] neo4j connection error.')
                    outfile =  os.path.join(webpage_folder, "sinks.out.json")
                    if not os.path.exists(outfile):
                        with open(outfile, 'w+') as fd:
                            error_json = {"error": str(e)}
                            json.dump(error_json, fd, ensure_ascii=False, indent=4)

            if do_source_analysis:
                LOGGER.info('[TR] starting to run the queries for sources.')
                try:
                    source_start_time = time.time()
                    DU.exec_fn_within_transaction(dom_selectors_py_source_traversals.run_traversals, webpage_url, webpage_folder, webpage, conn=constantsModule.NEO4J_CONN_STRING, conn_timeout=conn_timeout)
                    source_end_time = time.time()
                    log_execution_duration(source_start_time, source_end_time, 'source')
                except Exception as e:
                    LOGGER.error(e)
                    LOGGER.error('[TR] neo4j connection error.')


            LOGGER.info('[TR] stopping neo4j for %s'%str(database_name))
            DU.ineo_stop_db_instance(database_name)

            ## remove db after analysis
            LOGGER.info('[TR] removing neo4j for %s'%str(database_name))
            DU.ineo_remove_db_instance(database_name)




def analyze_hpg_for_tests(do_sink_analysis=False, do_source_analysis=False, overwrite=False, conn_timeout=None, should_change_delimiter=False):
    neo4j_database_name = 'neo4j'

    database_name = '{0}_{1}'.format('test', 'easy-test.js')

    webpage_folder = os.path.join(constantsModule.TEST_DIR, "sink-detection")
    nodes_file = os.path.join(webpage_folder, constantsModule.NODE_INPUT_FILE_NAME)
    rels_file =  os.path.join(webpage_folder, constantsModule.RELS_INPUT_FILE_NAME)


    if os.path.exists(nodes_file) and os.path.exists(rels_file):
        LOGGER.info('[TR] hpg files exist in decompressed format, skipping de-compression.')

    else:
        LOGGER.error('[TR] The nodes/rels.csv files do not exist in %s, skipping.'%webpage_folder)


    ### changing the delimiter of CSV files
    if should_change_delimiter:
        change_csv_delimiter(nodes_file, nodes_file)
        change_csv_delimiter(rels_file, rels_file)


    neo4j_http_port = constantsModule.NEO4J_HTTP_PORT
    neo4j_bolt_port = constantsModule.NEO4J_BOLT_PORT

    LOGGER.warning('[TR] removing any previous neo4j instance for %s'%str(database_name))
    DU.ineo_remove_db_instance(database_name)

    LOGGER.info('[TR] creating db %s with http port %s'%(database_name, neo4j_http_port))
    DU.ineo_create_db_instance(database_name, neo4j_http_port)

    # check if the bolt port requested by the config.yaml is not the default one
    if not ( int(neo4j_http_port) + 2 == int(neo4j_bolt_port) ):
        LOGGER.info('[TR] setting the requested bolt port %s for db %s'%(neo4j_bolt_port, database_name))
        DU.ineo_set_bolt_port_for_db_instance(database_name, neo4j_bolt_port)

    LOGGER.info('[TR] importing the database with neo4j-admin.')
    DU.neoadmin_import_db_instance(database_name, neo4j_database_name, nodes_file, rels_file)

    LOGGER.info('[TR] changing the default neo4j password to enable programmatic access.')
    DU.ineo_set_initial_password_and_restart(database_name, password=constantsModule.NEO4J_PASS)

    # compress the hpg after the model import
    # IOModule.compress_graph(new_webpage_directory)

    LOGGER.info('[TR] waiting for the neo4j connection to be ready...')
    time.sleep(10)
    LOGGER.info('[TR] connection: %s'%constantsModule.NEO4J_CONN_HTTP_STRING)
    connection_success = DU.wait_for_neo4j_bolt_connection(timeout=150, conn=constantsModule.NEO4J_CONN_HTTP_STRING)
    if not connection_success:
        try:
            LOGGER.info('[TR] stopping neo4j for %s'%str(database_name))
            DU.ineo_stop_db_instance(database_name)

            ## remove db after analysis
            DU.ineo_remove_db_instance(database_name)
        except:
            LOGGER.info('[TR] ran into exception while prematurely stopping neo4j for %s'%str(database_name))

    if do_sink_analysis:
        LOGGER.info('[TR] starting to run the queries for sinks.')
        try:
            DU.exec_fn_within_transaction(dom_selectors_py_sink_traversals.run_traversals, "", webpage_folder, "", conn=constantsModule.NEO4J_CONN_STRING, conn_timeout=conn_timeout)
        except Exception as e:
            LOGGER.error(e)
            LOGGER.error('[TR] neo4j connection error.')

    if do_source_analysis:
        LOGGER.info('[TR] starting to run the queries for sources.')
        try:
            DU.exec_fn_within_transaction(dom_selectors_py_source_traversals.run_traversals, "", webpage_folder, conn=constantsModule.NEO4J_CONN_STRING, conn_timeout=conn_timeout)
        except Exception as e:
            LOGGER.error(e)
            LOGGER.error('[TR] neo4j connection error.')


    LOGGER.info('[TR] stopping neo4j for %s'%str(database_name))
    DU.ineo_stop_db_instance(database_name)

    ## remove db after analysis
    LOGGER.info('[TR] removing neo4j for %s'%str(database_name))
    DU.ineo_remove_db_instance(database_name)
