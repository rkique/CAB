#!/usr/bin/env node

/*
Extract all URLs from a web page.
Usage: page.html > ./getURLs.js <base_url>
*/

const readline = require('readline');
const {JSDOM} = require('jsdom');
const {URL} = require('url');
const fs = require('fs');
const path = require('path');

let baseURL = process.argv[2];

if (baseURL.endsWith('index.html')) {
  baseURL = baseURL.slice(0, baseURL.length - 'index.html'.length);
} else {
  baseURL += '/';
}

const urlsFile = path.join(__dirname, '../d/urls.txt');
const existingURLs = new Set();

// read existing URLs from urls.txt
if (fs.existsSync(urlsFile)) {
  const fileContent = fs.readFileSync(urlsFile, 'utf-8');
  fileContent.split('\n').forEach((line) => {
    if (line.trim()) {
      existingURLs.add(line.trim());
    }
  });
}

const rl = readline.createInterface({
  input: process.stdin,
});

let html = '';
rl.on('line', (line) => {
  // 2. Read HTML input from standard input (stdin)
  // line by line using the `readline` module.
  html += `${line}\n`;
});

rl.on('close', () => {
  // 3. Parse HTML using jsdom
  const dom = new JSDOM(html);
  const document = dom.window.document;
  let anchors = document.querySelectorAll('a');
  const hasHref = (anchor) => {
    return anchor.getAttribute('href') != null;
  };
  anchors = Array.from(anchors).filter(hasHref);
  const hrefs = anchors.map((anchor) => {
    const href = anchor.getAttribute('href');
    // Resolve the URL using the URL constructor to normalize paths
    const resolvedURL = new URL(href, baseURL);
    return resolvedURL.href;
  });
  for (const href of hrefs) {
    if (!existingURLs.has(href)) {
      console.log(href);
    }
  }
});


