const { runIndexer } = require('../scripts/indexer.js');
const {
  applyFilters,
  getFaissK,
  buildDepartmentPriorityFilterStages,
  mergeStageResults,
} = require('./filters.js');

const DIST_PORT = 3001;
const GID = 'courses';

let distribution = null;
let allKeys = [];
let totalDocs = 0;

function init(dist) {
  distribution = dist;
}

function startDistributionNode(cb) {
  distribution.node.start(() => {
    console.log(`Distribution node started on port ${DIST_PORT}`);
    cb();
  });
}

function setupGroup(cb) {
  const id = distribution.util.id;
  const node = distribution.node.config;
  const group = {};
  group[id.getSID(node)] = node;
  distribution.local.groups.put({ gid: GID }, group, (e) => {
    if (e) return cb(e);
    console.log(`Group '${GID}' created`);
    cb();
  });
}

async function loadIndex(cb) {
  console.log('Running indexer...');
  const { index } = await runIndexer(distribution, GID);
  allKeys = Object.keys(index);
  totalDocs = allKeys.length;
  console.log(`Index has ${totalDocs} unique courses.`);

  const faissService = {
    buildFaiss: function(gid, keys, cb) {
      const records = [];
      let pending = keys.length;
      if (pending === 0) return cb(null, { built: 0 });
      keys.forEach((key) => {
        globalThis.distribution.local.store.get({ key, gid }, (err, record) => {
          if (!err && record) records.push(record);
          pending--;
          if (pending === 0) {
            globalThis.__buildLocalFaiss(records);
            cb(null, { built: records.length });
          }
        });
      });
    },
  };

  distribution[GID].routes.put(faissService, 'faiss', (err, val) => {
    console.log('routes.put callback fired, err:', err, 'val:', val);
    if (err && Object.values(err).length > 0) return cb(err);
    distribution[GID].comm.send([GID, allKeys], { service: 'faiss', method: 'buildFaiss' }, (err, results) => {
      if (err && Object.values(err).some(Boolean)) return cb(err);
      cb();
    });
  });
}

function _distFaissSearch(queryVec, k, filters, searchId, cb) {
  const queryVecJson = JSON.stringify(queryVec);
  const filtersJson = JSON.stringify(filters || []);
  const hasFilters = filters && filters.length > 0;

  const map = new Function('key', 'value', `
    var sid = '__faiss_${searchId}';
    if (globalThis[sid]) return [];
    globalThis[sid] = true;

    var filters = ${filtersJson};
    var hasFilters = ${hasFilters ? 'true' : 'false'};

    var searchFn = hasFilters && typeof globalThis.__localFaissSearchFiltered === 'function'
      ? globalThis.__localFaissSearchFiltered
      : globalThis.__localFaissSearch;

    if (typeof searchFn !== 'function') {
      throw new Error('FAISS search function not ready — buildFaiss may not have run');
    }

    var queryVector = ${queryVecJson};
    var results = hasFilters
      ? searchFn(queryVector, ${k}, filters)
      : searchFn(queryVector, ${k});

    return results.map(function(r) {
      var o = {};
      o['results'] = r;
      return o;
    });
  `);

  const reduce = (_, values) => {
    const out = {};
    out['results'] = values;
    return out;
  };

  distribution[GID].mr.exec({ keys: allKeys, map, reduce }, (err, results) => {
    if (err) return cb(err);

    const docs = [];
    for (const item of results) {
      if (item['results']) {
        const v = item['results'];
        if (Array.isArray(v)) docs.push(...v);
        else docs.push(v);
      }
    }

    const seen = new Set();
    const merged = docs
      .sort((a, b) => b.score - a.score)
      .filter((r) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      })
      .slice(0, k);

    cb(null, merged);
  });
}

function _hydrateResults(codes, cb) {
  if (codes.length === 0) return cb(null, []);
  let pending = codes.length;
  const fullResults = [];
  let errored = false;

  codes.forEach(({ code, score }) => {
    distribution[GID].store.get(code, (err, record) => {
      if (errored) return;
      if (err) { errored = true; return cb(err); }
      fullResults.push({ ...record, score });
      pending--;
      if (pending === 0) cb(null, fullResults);
    });
  });
}

function searchFaiss(queryVec, filters, t0, cb) {
  const topK = 40;
  const hasFilters = filters.length > 0;
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2);

  _distFaissSearch(queryVec, topK, [], `${ts}_unf_${rnd}`, (err, unfilteredMerged) => {
    if (err) return cb(err);

    _hydrateResults(unfilteredMerged, (err, unfilteredFull) => {
      if (err) return cb(err);

      if (!hasFilters) {
        return cb(null, {
          filteredResults: unfilteredFull.slice(0, topK),
          unfilteredResults: unfilteredFull.slice(0, topK),
          time_ms: Date.now() - t0,
          total_docs: totalDocs,
          mode: 'faiss',
          filters,
        });
      }

      const departmentStages = buildDepartmentPriorityFilterStages(filters);
      if (departmentStages) {
        const stagedMerged = [];

        function finalizeDepartmentStages() {
          const prioritizedMerged = mergeStageResults(stagedMerged, topK);
          _hydrateResults(prioritizedMerged, (hydrateErr, filteredFull) => {
            if (hydrateErr) return cb(hydrateErr);

            const fullFilterMatches = applyFilters(filteredFull, filters);
            const deptOnlyMatches = applyFilters(filteredFull, departmentStages[0]);

            console.log(`[dist] dept-priority stages: ${departmentStages.length}, full-filter: ${fullFilterMatches.length}, dept-only: ${deptOnlyMatches.length}, unfiltered: ${unfilteredFull.length}`);

            const unmatchedFilters = fullFilterMatches.length === 0 && deptOnlyMatches.length > 0
              ? filters.filter((f) => !departmentStages[0].some((sf) => sf.field === f.field && sf.op === f.op))
              : [];

            cb(null, {
              filteredResults: fullFilterMatches.slice(0, topK),
              partialMatches: fullFilterMatches.length === 0 ? deptOnlyMatches.slice(0, topK) : [],
              unmatchedFilters,
              unfilteredResults: unfilteredFull.slice(0, topK),
              time_ms: Date.now() - t0,
              total_docs: totalDocs,
              mode: 'faiss',
              filters,
            });
          });
        }

        function runDepartmentStage(idx) {
          if (idx >= departmentStages.length) return finalizeDepartmentStages();
          const stageFilters = departmentStages[idx];
          const stageK = getFaissK(topK, stageFilters);
          _distFaissSearch(queryVec, stageK, stageFilters, `${ts}_dep_${idx}_${rnd}`, (stageErr, stageMerged) => {
            if (stageErr) return cb(stageErr);
            stagedMerged.push(stageMerged || []);
            if (mergeStageResults(stagedMerged, topK).length >= topK) return finalizeDepartmentStages();
            return runDepartmentStage(idx + 1);
          });
        }

        return runDepartmentStage(0);
      }

      const faissK = getFaissK(topK, filters);
      _distFaissSearch(queryVec, faissK, filters, `${ts}_fil_${rnd}`, (err, filteredMerged) => {
        if (err) return cb(err);

        _hydrateResults(filteredMerged, (err, filteredFull) => {
          if (err) return cb(err);

          const filteredSectioned = applyFilters(filteredFull, filters);
          console.log(`[dist] filtered: ${filteredSectioned.length}, unfiltered: ${unfilteredFull.length}`);

          cb(null, {
            filteredResults: filteredSectioned.slice(0, topK),
            unfilteredResults: unfilteredFull.slice(0, topK),
            time_ms: Date.now() - t0,
            total_docs: totalDocs,
            mode: 'faiss',
            filters,
          });
        });
      });
    });
  });
}

function getAllKeys() { return allKeys; }
function getTotalDocs() { return totalDocs; }

module.exports = {
  DIST_PORT,
  GID,
  init,
  startDistributionNode,
  setupGroup,
  loadIndex,
  searchFaiss,
  getAllKeys,
  getTotalDocs,
};
