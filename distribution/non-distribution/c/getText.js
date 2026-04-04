#!/usr/bin/env node

/*
Extract all text from an HTML page.
Usage: input > ./getText.js > output
Note: will convert headings to uppercase.
*/

const {convert} = require('html-to-text');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
});

let html = '';
rl.on('line', (line) => {
  // 1. Read HTML input from standard input, line by line using the `readline` module.
  html += `${line}\n`;
});

// 2. after input is received,
//  use convert to only output text elements.
rl.on('close', () => {
  const text = convert(html);
  console.log(text);
});
