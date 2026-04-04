const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

const words = [];

rl.on('line', (line) => {
    words.push(line.trim());
});

rl.on('close', () => {
    const grams = [1, 2, 3];
    for (const gram of grams) {
        for (let i = 0; i <= words.length - gram; i++) {
            const ngram = words.slice(i, i + gram).join(' ');
            console.log(ngram);
        }
    }
});