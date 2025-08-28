#!/bin/bash
# /etc/init.d/persist-ramdisk

PERSIST_STORE=/mnt/data
RAMDISK=/mnt/ramdisk/data
CRAWLER=/mnt/Playcrawler
EMPTYDIR=/mnt/empty_dir

screen -wipe
screen -wipe

echo "stopping crawler instances";
(cd ${CRAWLER} && bash kill.sh);

echo "Persisting ramdisk contents";
rsync --quiet --archive --recursive --force ${RAMDISK}/ ${PERSIST_STORE};

echo "Removing ramfs files";
rsync -a --delete ${EMPTYDIR}/ ${RAMDISK}/

sleep 10s;

echo "restarting the crawler";
(cd ${CRAWLER} && bash dom_run_all.sh);

exit 0



##### 
# rsync -a --delete /mnt/web-permissions-project/empty_dir/ /mnt/ramdiskpermissions/crawl-data-ram/
# rsync --quiet --archive --recursive --force /mnt/ramdiskpermissions/ /mnt/web-permissions-project/crawl-data-persisted;

# for i in $(pwd)/crawl-data-persisted/crawl-data-ram/*; do mv "$i" $(pwd)/crawl-data; done

# rsync -a --delete /mnt/web-permissions-project/empty_dir/ /mnt/web-permissions-project/crawl-data-persisted/crawl-data-ram/
# fswatch /mnt/ramdiskpermissions/shm/tmpdir
# cp -alr /crawl-data-persisted/crawl-data-ram/. crawl-data
