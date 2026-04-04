#!/usr/bin/env node

/*
Convert each term to its stem
Usage: input > ./stem.js > output
*/

const readline = require('readline');
const natural = require('natural');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// For each line, log the Porter Stem of the string.
rl.on('line', function(line) {
  const stringArray = line.split(' ');
  console.log(stringArray
      .map((word, i, _) =>
        natural.PorterStemmer.stem(word), stringArray)
      .join(' '));
});

