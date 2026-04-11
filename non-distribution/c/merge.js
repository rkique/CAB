#!/usr/bin/env node
const fs = require('fs');
// const { url } = require('inspector');
const readline = require('readline');
const compare = (a, b) => {
  if (a.freq > b.freq) {
    return -1;
  } else if (a.freq < b.freq) {
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
  localIndex += line + '\n';
});

rl.on('close', () => {
  // 2. Read the global index name/location, using process.argv
  // and call printMerged as a callback
  const globalFile = process.argv[2];
  fs.readFile(globalFile, 'utf8', printMerged);
});

const printMerged = (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

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
    const [term, freq, url] = line.split('|').map((s) => s.trim());
    if (!local[term]) {
      local[term] = new Map();
    }
    local[term].set(url, parseInt(freq, 10));
  }

  // 4. For each line in `globalIndexLines`, parse them and add them to the `global` object
  // where keys are terms and values are url->freq maps (one entry per url).
  // Use the .trim() method to remove leading and trailing whitespace from a string.
  for (const line of globalIndexLines) {
    if (!line.trim()) continue;
    const [termPart, rest] = line.split('|');
    const term = termPart.trim();
    const tokens = rest.trim().split(/\s+/);

    const grouped = new Map();
    for (let i = 0; i < tokens.length; i += 2) {
      const url = tokens[i];
      const freq = parseInt(tokens[i + 1], 10);
      grouped.set(url, freq);
    }
    global[term] = grouped; // Map<url, freq>
  }


  // 5. Merge the local index into the global index:
  // - For each term in the local index, if the term exists in the global index:
  //     - Merge by url so there is at most one entry per url.
  //     - Sum frequencies for duplicate urls.
  // - If the term does not exist in the global index:
  //     - Add it as a new entry with the local index's data.
  // 6. Print the merged index to the console in the same format as the global index file:
  //    - Each line contains a term, followed by a pipe (`|`), followed by space-separated pairs of `url` and `freq`.
  //    - Terms should be printed in alphabetical order.

  for (const term of Object.keys(local)) {
    if (!global[term]) {
      global[term] = new Map(local[term]);
    } else {
      for (const [url, freq] of local[term]) {
        global[term].set(url, (global[term].get(url) || 0) + freq);
      }
    }
  }

  const terms = Object.keys(global).sort();
  for (const term of terms) {
    const entries = Array.from(global[term], ([url, freq]) => ({url, freq}));
    entries.sort(compare);

    const parts = [];
    for (const {url, freq} of entries) {
      parts.push(url, freq);
    }
    console.log(`${term} | ${parts.join(' ')}`);
  }
};
