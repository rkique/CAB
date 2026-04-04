const fs = require('fs')
const path = require('path')

let input = ''

//read from stdin as a stream
process.stdin.on('data', (chunk) => { input += chunk.toString()});
process.stdin.on('end', () => {
    let text = input.replace(/[^a-zA-Z]/g, '\n')
    text = text.toLowerCase()
    const stopwords = new Set(fs.readFileSync(path.join(__dirname,
         '../d/stopwords.txt'), 'utf8').split('\n').map(w => w.trim()))
    const words = text.split('\n')
        .filter(w => w && !stopwords.has(w))
    console.log(words.join('\n'))

});
