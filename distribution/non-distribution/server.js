#!/usr/bin/env node

const http = require('http');
const {exec} = require('child_process');
const {performance} = require('perf_hooks');

const PORT = 8080;
const SCRIPT_PATH = './t/test-end_to_end.sh';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';

    // 1. Collect data chunks as they arrive
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    // 2. Once all data is received
    req.on('end', () => {
      let name = 'Anonymous';
      try {
        // Assume the user sends JSON: {"name": "John"}
        const parsedBody = JSON.parse(body);
        name = parsedBody.name || 'Anonymous';
      } catch (e) {
        // If not JSON, just use the raw string or fallback
        name = body || 'Anonymous';
      }

      // Display the name on the SERVER side (your EC2 terminal)
      console.log(`\x1b[36m[Triggered by]: ${name}\x1b[0m`);

      const startTime = performance.now();

      // 3. Execute your script
      exec(`${SCRIPT_PATH}`, (error, stdout, stderr) => {
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(3);

        console.log(`\x1b[32mExecution finished. Check client for results.\x1b[0m`);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          status: error ? 'error' : 'success',
          user: name,
          output: stdout.trim(),
          errors: stderr.trim(),
          duration: `${duration} ms`,
        }));
      });
    });
  } else {
    res.writeHead(404);
    res.end('Use POST /execute');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}...`);
});
