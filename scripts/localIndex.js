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

function matchesCondition(fieldValue, op, value) {
    if (fieldValue === null || fieldValue === undefined) return false;
    switch (op) {
        case 'eq': return fieldValue === value;
        case 'ne': return fieldValue !== value;
        case 'lt': return typeof fieldValue === 'number' && fieldValue < value;
        case 'gt': return typeof fieldValue === 'number' && fieldValue > value;
        case 'lte': return typeof fieldValue === 'number' && fieldValue <= value;
        case 'gte': return typeof fieldValue === 'number' && fieldValue >= value;
        case 'includes_all':
            return Array.isArray(fieldValue) && Array.isArray(value) &&
                value.every((v) => fieldValue.includes(v));
        case 'includes_any':
            return Array.isArray(fieldValue) && Array.isArray(value) &&
                value.some((v) => fieldValue.includes(v));
        default: return false;
    }
}

function getRecordCodePrefix(record) {
    return String(record && record.code ? record.code : '').split(/\s+/)[0].toUpperCase();
}

function matchesFilter(record, section, condition) {
    if (!condition) return true;

    if (condition.field === 'code_prefix') {
        const prefix = getRecordCodePrefix(record);
        if (!prefix) return false;

        if (condition.op === 'eq') return prefix === String(condition.value || '').toUpperCase();
        if (condition.op === 'ne') return prefix !== String(condition.value || '').toUpperCase();

        if ((condition.op === 'includes_any' || condition.op === 'includes_all') && Array.isArray(condition.value)) {
            const values = condition.value.map((v) => String(v || '').toUpperCase());
            return values.includes(prefix);
        }

        return false;
    }

    return matchesCondition(section[condition.field], condition.op, condition.value);
}

function localSearchFiltered(queryVector, topK = 20, filters = []) {
    if (!allRecords || allRecords.length === 0) return [];
    if (!Array.isArray(filters) || filters.length === 0) return localSearch(queryVector, topK);

    const filtered = allRecords.filter((r) => {
        const sections = r.sections || [];
        return sections.some((s) =>
            filters.every((c) => matchesFilter(r, s, c))
        );
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