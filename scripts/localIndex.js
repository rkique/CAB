const { IndexFlatIP, Index } = require('faiss-node');

let faissIndex = null;
let idMap = [];

/* 
This file manages the local FAISS index on each node. 
It provides functions to build the index from a subset of data and perform local searches.
 The main indexer script will call these functions to create and query the local shards.
*/
function buildLocalFaiss(data) {
    if (!data || data.length ===0) {
        console.log('No records on this node.');
        return;
    }
    const dim = data[0].vector.length;
    faissIndex = new IndexFlatIP(dim);
    idMap = [];

    const flat = [];
    for (const d of data) {
        flat.push(...d.vector);
        idMap.push(d.code);
    }

    faissIndex.add(flat);
    console.log(`Local FAISS shard ready: ${faissIndex.ntotal()} vectors.`);
}

/*
Performs a local search on the FAISS index with the given query vector and returns the top K results.
Each result includes the course code and the similarity score.
*/

function localSearch(queryVector, topK=20) {
    if (!faissIndex || faissIndex.ntotal() === 0) return [];

    const k = Math.min(topK, faissIndex.ntotal());
    const { labels, distances } = faissIndex.search(queryVector, k);
    return labels.map((idx, i) => ({
        code: idMap[idx],
        score: distances[i]
    }));
}

module.exports = {buildLocalFaiss, localSearch };