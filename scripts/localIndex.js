const { IndexFlatIP, Index } = require('faiss-node');

let faissIndex = null;
let idMap = [];
let allRecords = [];

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

    allRecords = data;

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

function localSearchFiltered(queryVector, topK = 20, filters = {}) {
    if (!allRecords || allRecords.length === 0) return [];

    const filtered = allRecords.filter((r) => {
        if (!filters.days && !filters.season && !filters.year) return true;

        const sections = r.sections || [];

        return sections.some((s) => {
        if (filters.days?.length > 0) {
            if (!filters.days.every((d) => (s.days || []).includes(d))) return false;
        }
        if (filters.season && s.season !== filters.season) return false;
        if (filters.year && s.year !== filters.year) return false;
        return true;
        });
    })

    if (filtered.length === 0) return [];

    const { IndexFlatIP } = require('faiss-node');
    const dim = filtered[0].vector.length;
    const tempIndex = new IndexFlatIP(dim);
    const tempIdMap = [];
    const flat = [];
    for (const r of filtered) {
        if (!r.vector) continue;
        flat.push(...r.vector);
        tempIdMap.push(r.code);
    }

    if (flat.length === 0) return [];

    tempIndex.add(flat);
    const k = Math.min(topK, tempIndex.ntotal());
    const { labels, distances } = tempIndex.search(queryVector, k);

    return labels.map((idx, i) => ({
        code: tempIdMap[idx],
        score: distances[i]
    }));
}

module.exports = {buildLocalFaiss, localSearch, localSearchFiltered };