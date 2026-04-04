#!/usr/bin/env node

// outputs persist in global-index.txt

/*
Merge the current inverted index (assuming the right structure) with the global index file
Usage: input > ./merge.js global-index > output

The inverted indices have the different structures!

Each line of a local index is formatted as:
  - `<word/ngram> | <frequency> | <url>`

//for simple frequency tracking, only keep track of occurrences of word at url.
Each line of the global index is formatted as:
  - `<word/ngram> | <url_1> <frequency_1> <url_2> <frequency_2> ... <url_n> <frequency_n>`
  - Where pairs of `url` and `frequency` are in descending order of frequency
  - Everything after `|` is space-separated

-------------------------------------------------------------------------------------
Example merge of current inverted index to global index.

local index:
  word1 word2 | 8 | url1
  word3 | 1 | url9
EXISTING global index:
  word1 word2 | url4 2
  word3 | url3 2

merge into the NEW global index:
  word1 word2 | url1 8 url4 2
  word3 | url3 2 url9 1

Remember to error gracefully, particularly when reading the global index file.
*/

const fs = require('fs');
const readline = require('readline');
// The `compare` function can be used for sorting.
const compare = (aFreq, bFreq) => {
  if (aFreq > bFreq) {
    return -1;
  } else if (aFreq < bFreq) {
    return 1;
  } else {
    return 0;
  }
};
const rl = readline.createInterface({
  input: process.stdin,
});


// 1. Read the incoming local index data from standard input (stdin) line by line.
let localIndex = '';
rl.on('line', (line) => {
  localIndex += `${line}\n`;
});

// 2. Read from the global index name/location
// This is allowed to be called in a single instance.
const globalIndexName = process.argv[2];
rl.on('close', () => {
  // console.log(`[debug] reading global index from ${globalIndexName}`);
  fs.readFile(globalIndexName, printMerged);
});

const printMerged = (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }
  data = data.toString();
  // Split the data into an array of lines
  const localIndexLines = localIndex.split('\n');
  const globalIndexLines = data.split('\n');
  localIndexLines.pop();
  globalIndexLines.pop();

  const local = {};
  const global = {};

  // 3. For each line in `localIndexLines`, parse them and add them to the `local` object
  // where keys are terms and values store a url->freq map (one entry per url).
  for (const line of localIndexLines) {
    // parse line
    const lineArray = line.split('|').map((str) => str.trim());
    const term = lineArray[0];
    const freq = Number(lineArray[1]);
    const url = lineArray[2];
    if (!local[term]) local[term] = {};
    if (!local[term][url]) local[term][url] = 0;
    local[term][url] += freq;
  }
  // 4. For each line in `globalIndexLines`, parse them and add them to the `global` object
  // where keys are terms and values are url->freq maps (one entry per url).

  // `<word/ngram> | <url_1> <frequency_1> <url_2> <frequency_2> ... <url_n> <frequency_n>`

  for (const line of globalIndexLines) {
    const lineArray = line.split('|').map((str) => str.trim());
    if (lineArray.length < 2) continue;
    const grouped = {};
    const term = lineArray[0];
    const urlFreqs = lineArray[1].split(' ');
    for (let i = 0; i < urlFreqs.length - 1; i+=2) {
      // console.log(`freqs is ${urls_freqs[i+1]}`);
      grouped[urlFreqs[i]] = Number(urlFreqs[i+1]);
    }
    global[term] = grouped;
  }

  // 5. Merge the local index into the global index
  // - For each term in the local index, if the term exists in the global index:
  //     - Merge by url so there is at most one entry per url.
  //     - Sum frequencies for duplicate urls.
  // - If the term does not exist in the global index:
  //     - Add it as a new entry with the local index's data.
  for (const term in local) {
    if (global[term]) {
      for (const url in local[term]) {
        if (!global[term][url]) global[term][url] = 0;
        global[term][url] += Number(local[term][url]);
      }
    } else {
      global[term] = local[term];
    }
  }
  // 6. Print the merged index to the console in the same format as the global index file:
  // Each line contains a term, followed by a pipe (`|`), followed by space-separated pairs of `url` and `freq`.
  const sortedGlobal = Object.keys(global)
      .sort()
      .reduce((acc, key) => {
        acc[key] = global[key];
        return acc;
      }, {});
  for (const term in sortedGlobal) {
    let msg = `${term} | `;
    // grouped is url -> freq and is sorted by frequency.
    const grouped = sortedGlobal[term];
    const sortedGrouped = Object.keys(grouped)
        .sort((a, b) => {
          return compare(grouped[a], grouped[b]);
        }).reduce((acc, key) => {
          acc[key] = grouped[key];
          return acc;
        }, {});
    for (const url in sortedGrouped) {
      msg += `${url} ${sortedGrouped[url]} `;
    }
    console.log(msg);
  }
};
