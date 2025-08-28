import argparse
import analyses.general.data_flow as DF
import hpg_neo4j.db_utility as DU
import sys
import json


from utils.logging import logger as LOGGER

def main():
    itr_number = sys.argv[1]
    varname = sys.argv[2]
    sink_cfg_node_id = sys.argv[3]
    conn = sys.argv[4]
    output_filename = sys.argv[5]
    
    existing_data = []

    if itr_number == '1':
        try:
            slice_values = DU.exec_fn_within_transaction(DF._get_varname_value_from_context, varname, sink_cfg_node_id, conn=conn, conn_timeout=3*60)
            if slice_values:
                try:
                    with open(output_filename, "w", encoding="utf-8") as output_file:
                        json.dump(slice_values, output_file, ensure_ascii=False)
                except:
                    LOGGER.error('error while writing on subprocess_output.json during first phase')

        except Exception as e:
            LOGGER.info("Error during first iteration: %s"%(e))

    elif itr_number == '2':
        try:
            try:
                with open(output_filename, "r", encoding="utf-8") as existing_file:
                    existing_data = json.load(existing_file)

            except Exception as e:
                LOGGER.info('cannot open subprocess_output.json')

            function_return_value_slices = DU.exec_fn_within_transaction(DF.get_value_of_return_value_of_function_from_context, varname, sink_cfg_node_id, conn=conn, conn_timeout=3*60)
            if function_return_value_slices:
                existing_data.extend(function_return_value_slices)
                try:
                    with open(output_filename, "w", encoding="utf-8") as output_file:
                        json.dump(existing_data, output_file, ensure_ascii=False)
                except:
                    LOGGER.error('error while writing on subprocess_output.json during second phase')

        except Exception as e:
            LOGGER.info("Error during second iteration: %s"%(e))

if __name__ == "__main__":
    main()

