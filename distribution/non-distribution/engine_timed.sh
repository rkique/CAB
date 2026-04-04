#!/bin/bash
# This is the main entry point of the search engine.
cd "$(dirname "$0")" || exit 1

count=0
elapsed_crawl_time=0
elapsed_index_time=0

while read -r url; do

  if [[ "$url" == "stop" ]]; then
    # stop the engine if it sees the string "stop" 
    exit;
  fi
  ((count++))
  
  # keep track of total crawl time
  start_crawl_time=$(date +%s)
  echo "[engine] crawling $url">/dev/stderr
  ./crawl.sh "$url" >d/content.txt
  end_crawl_time=$(date +%s)
  elapsed_crawl_time=$((elapsed_crawl_time + end_crawl_time - start_crawl_time))

  #keep track of total index time
    start_index_time=$(date +%s)
  echo "[engine] indexing $url">/dev/stderr
  ./index.sh d/content.txt "$url"
    end_index_time=$(date +%s)
    elapsed_index_time=$((elapsed_index_time + end_index_time - start_index_time))

  if  [[ "$(cat d/visited.txt | wc -l)" -ge "$(cat d/urls.txt | wc -l)" ]]; then
      # stop the engine if it has seen all available URLs
      #report total times and count
        echo "[engine] total crawled URLs: $count" >&2
        echo "[engine] total crawl time (s): $elapsed_crawl_time" >&2
        echo "[engine] total index time (s): $elapsed_index_time" >&2
      break;
  fi

done < <(tail -f d/urls.txt)
