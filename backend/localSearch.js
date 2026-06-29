const { runIndexer, buildCourseMap, buildIndex } = require('../scripts/indexer.js');
const { buildLocalFaiss, localSearch, localSearchFiltered } = require('../scripts/localIndex.js');
const {
  applyFilters,
  getFaissK,
  buildDepartmentPriorityFilterStages,
  mergeStageResults,
} = require('./filters.js');

// Expose FAISS functions on globalThis so the distribution map functions can call them
globalThis.__buildLocalFaiss = buildLocalFaiss;
globalThis.__localFaissSearch = localSearch;
globalThis.__localFaissSearchFiltered = localSearchFiltered;

let localIndex = null;
let allKeys = [];
let totalDocs = 0;

async function loadIndexLocal(cb) {
  console.log('Running indexer (local mode — no distribution)...');
  const courseMap = await buildCourseMap();
  const index = await buildIndex(courseMap);
  localIndex = index;
  allKeys = Object.keys(index);
  totalDocs = allKeys.length;
  console.log(`Index has ${totalDocs} unique courses.`);
  const records = Object.values(index);
  buildLocalFaiss(records);
  console.log('Local FAISS index built.');
  cb();
}

function searchFaissLocal(queryVec, filters, t0, cb) {
  const topK = 40;
  const hasFilters = filters.length > 0;

  const unfilteredResults = localSearch(queryVec, topK);
  const unfilteredFull = unfilteredResults.map(({ code, score }) => ({
    ...localIndex[code],
    score,
  }));

  if (!hasFilters) {
    return cb(null, {
      filteredResults: unfilteredFull.slice(0, topK),
      unfilteredResults: unfilteredFull.slice(0, topK),
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'faiss-local',
      filters,
    });
  }

  const departmentStages = buildDepartmentPriorityFilterStages(filters);
  if (departmentStages) {
    const stagedFiltered = departmentStages.map((stageFilters) => {
      const stageK = getFaissK(topK, stageFilters);
      return localSearchFiltered(queryVec, stageK, stageFilters);
    });

    const prioritizedFiltered = mergeStageResults(stagedFiltered, topK);
    const filteredFull = prioritizedFiltered.map(({ code, score }) => ({
      ...localIndex[code],
      score,
    }));

    const fullFilterMatches = applyFilters(filteredFull, filters);
    const deptOnlyMatches = applyFilters(filteredFull, departmentStages[0]);

    console.log(`[local] dept-priority stages: ${departmentStages.length}, full-filter: ${fullFilterMatches.length}, dept-only: ${deptOnlyMatches.length}`);

    const unmatchedFilters = fullFilterMatches.length === 0 && deptOnlyMatches.length > 0
      ? filters.filter((f) => !departmentStages[0].some((sf) => sf.field === f.field && sf.op === f.op))
      : [];

    return cb(null, {
      filteredResults: fullFilterMatches.slice(0, topK),
      partialMatches: fullFilterMatches.length === 0 ? deptOnlyMatches.slice(0, topK) : [],
      unmatchedFilters,
      unfilteredResults: unfilteredFull.slice(0, topK),
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'faiss-local',
      filters,
    });
  }

  const faissK = getFaissK(topK, filters);
  const filteredResults = localSearchFiltered(queryVec, faissK, filters);

  console.log(`[local] unfiltered: ${unfilteredResults.length}, filtered: ${filteredResults.length}, filters: ${JSON.stringify(filters)}`);

  const filteredFull = filteredResults.map(({ code, score }) => ({
    ...localIndex[code],
    score,
  }));
  const filteredSectioned = applyFilters(filteredFull, filters);

  cb(null, {
    filteredResults: filteredSectioned.slice(0, topK),
    unfilteredResults: unfilteredFull.slice(0, topK),
    time_ms: Date.now() - t0,
    total_docs: totalDocs,
    mode: 'faiss-local',
    filters,
  });
}

function getLocalIndex() { return localIndex; }
function getAllKeys() { return allKeys; }
function getTotalDocs() { return totalDocs; }

module.exports = { loadIndexLocal, searchFaissLocal, getLocalIndex, getAllKeys, getTotalDocs };
