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

rl.on('line', function(line) {
  // Print the Porter stem from `natural` for each element of the stream.
  const words = line.trim().split(/\s+/);

  const stemmedWords = words.map((word) =>
    natural.PorterStemmer.stem(word));

  console.log(stemmedWords.join(' '));
});
