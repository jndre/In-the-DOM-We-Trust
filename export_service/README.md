# Crawling Setup for running the Desanitization Taintfox Experiment

## Usage

### Build Foxhound

1. Now you can start Foxhound with Playwright, wooho!

### Prepare

```sh
FOXHOUND_PATH=/home/leen/Projects/TU_BS/taintfox/project-foxhound/obj-build-playwright/dist/bin/firefox 
node index.js --task=seed --modules=desanitization,tainting --browser=foxhound ```

### Crawl!

```sh
FOXHOUND_PATH=/home/leen/Projects/TU_BS/taintfox/project-foxhound/obj-build-playwright/dist/bin/firefox 
./startup.sh "desanitization,tainting" crawl foxhound 2
```

In Playcrawler directory, replace FOXHOUND_PATH accordingly.
