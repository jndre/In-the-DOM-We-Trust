node -max-old-space-size=16098 --huge-max-old-generation-size main.js --module=fingerprinter --task=crawl --id="$1" --total="$2"  >> logs/crawl$1.txt 2>&1
