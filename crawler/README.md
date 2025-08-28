# Playcrawler

This is a crawler based on the artifact of "Accept All Exploits: Exploring the Security Impact of Cookie Banners" (ACSAC'22).

We expanded it and developed the `snapshoter` crawling module in `modules` folder:


## Setup
```bash
npm install
```

## Usage
```bash
# Seed database for multiple modules 
node main.js --module=snapshoter,default --task=seed

# Crawl with multiple modules
node main.js --module=snapshoter,default --task=crawl
```

For the second part you can simply use the following to crawl with several instances while avoiding race conditions:
```bash
bash startup.sh cookies crawl chromium 11
```

Here `snapshoter` is the module, `crawl` the task and `chromium` the used browser and `11` the 
number of instances to start.

The crawling runs in the background, i.e., you have to manually kill the processes to stop the run. This is easiest done by running:
```bash
bash kill.sh
```

### Number of instances

Each crawler is assigned an ID (e.g., `0` to `10` for `11`) and selects all pages which have an id where `page_id%total == id`. Therefore **the total number has to be a prime number to avoid collissions**

## Documentation

Additional documentation is provided in the [docs](./docs/) folder.
