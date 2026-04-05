// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").NID} NID
 */

/**
 * Map functions used for mapreduce

 * @callback Mapper
 * @param {string} key
 * @param {any} value
 * @returns {object[]}
 */

/**
 * Reduce functions used for mapreduce
 * @callback Reducer
 * @param {string} key
 * @param {any[]} value
 * @returns {object}
 */

/**
 * @typedef {Object} MRConfig
 * @property {Mapper} map
 * @property {Reducer} reduce
 * @property {string[]} keys
 *
 * @typedef {Object} Mr
 * @property {(configuration: MRConfig, callback: Callback) => void} exec
 */


/*
  Note: The only method explicitly exposed in the `mr` service is `exec`.
  Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
  installed on the remote nodes and not necessarily exposed to the user.
*/

const {inspect} = require('util');
const makeStore = require('./store.js');

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  /**
   * @param {MRConfig} configuration
   * @param {Callback} callback
   * @returns {void}
   */
  function exec(configuration, callback) {
    try {
      const id = globalThis.distribution.util.id;
      const util = globalThis.distribution.util;

      const mrID = id.getID(`${util.serialize(configuration)}:${Date.now()}:${Math.random()}`);
      const mrGid = context.gid;
      const serviceName = `mr${mrID}`;
      const shuffleGid = `mr${mrID}shuffle`;

      const dist = globalThis.distribution;
      const groupRoutes = dist[context.gid].routes;
      const groupComm = dist[context.gid].comm;

      const hasRealError = (e) => {
        if (!e) return false;
        if (e instanceof Error) return true;
        if (typeof e !== 'object') return true;
        return Object.keys(e).length > 0;
      };

      const flattenCommValues = (valuesObj) => {
        const out = [];
        if (!valuesObj) return out;
        for (const sid of Object.keys(valuesObj)) {
          const v = valuesObj[sid];
          if (Array.isArray(v)) out.push(...v);
          else if (v !== undefined && v !== null) out.push(v);
        }
        return out;
      };

      const collectMappedKeys = (valuesObj) => {
        const keys = new Set();
        if (!valuesObj) return [];
        for (const sid of Object.keys(valuesObj)) {
          const arr = valuesObj[sid];
          if (!Array.isArray(arr)) continue;
          for (const obj of arr) {
            if (!obj || typeof obj !== 'object') continue;
            for (const k of Object.keys(obj)) {
              keys.add(k);
            }
          }
        }
        return Array.from(keys);
      };

      const cleanupAndFinish = (err, value) => {
        if (err) {
          const wrapped = err instanceof Error ?
            err :
            new Error(inspect(err, {depth: null}));
      
          console.error('MR ERROR:', wrapped.stack || inspect(wrapped, {depth: null}));
      
          groupRoutes.rem(serviceName, () => {
            callback(wrapped, null);
          });
          return;
        }
      
        groupRoutes.rem(serviceName, () => {
          callback(null, value);
        });
      };

      const setupShuffleGroup = (cb) => {
        try {
          if (!dist[shuffleGid]) {
            dist[shuffleGid] = dist.__setup({gid: shuffleGid});
          }

          dist.local.groups.get(context.gid, (e, members) => {
            if (e) return cb(e);

            const shuffleConfig = {gid: shuffleGid};

            dist.local.groups.put(shuffleConfig, members, (e1) => {
              if (hasRealError(e1)) return cb(e1);

              dist[context.gid].groups.put(shuffleConfig, members, (e2) => {
                if (hasRealError(e2)) return cb(e2);
                return cb(null, true);
              });
            });
          });
        } catch (err) {
          return cb(err);
        }
      };

      const mrService = {
        mapper: configuration.map,
        reducer: configuration.reduce,
        inputKeys: configuration.keys,
        reduceKeys: [],

        map: function(mrGid, mrID, callback) {
          try {
            const localStore = globalThis.distribution.local.store;
            const localRoutes = globalThis.distribution.local.routes;
            const localServiceName = `mr${mrID}`;

            localRoutes.get(localServiceName, (routeErr, svc) => {
              if (routeErr) return callback(routeErr);

              const mapper = svc && svc.mapper;
              const inputKeys = Array.isArray(svc && svc.inputKeys) ? svc.inputKeys : [];
              const mapped = [];
              let i = 0;

              const done = () => {
                localStore.put(mapped, {gid: `${mrID}_map`, key: 'mapped'}, (putErr) => {
                  if (putErr) return callback(putErr);
                  return callback(null, mapped);
                });
              };

              const next = () => {
                if (i >= inputKeys.length) return done();

                const key = inputKeys[i++];
                localStore.get({gid: mrGid, key}, (e, value) => {
                  if (e) {
                    const msg = String(e && e.message ? e.message : e);
                  if (/ENOENT|no such file|not found for group|File .* not found/i.test(msg)) {
                    return next();
                  }
                  return callback(e);
                }
                

                  let out;
                  try {
                    out = mapper(key, value);
                  } catch (err) {
                    return callback(err);
                  }

                  if (Array.isArray(out)) {
                    mapped.push(...out);
                  } else if (out && typeof out === 'object') {
                    mapped.push(out);
                  }

                  return next();
                });
              };

              return next();
            });
          } catch (err) {
            return callback(err);
          }
        },

        shuffle: function(gid, mrID, callback) {
          try {
            const localStore = globalThis.distribution.local.store;
            const distStore = makeStore({gid});

            localStore.get({gid: `${mrID}_map`, key: 'mapped'}, (e, mapped) => {
              if (e) {
                const msg = String(e && e.message ? e.message : e);
                if (/ENOENT|no such file/i.test(msg)) {
                  return callback(null, []);
                }
                return callback(e);
              }

              const arr = Array.isArray(mapped) ? mapped : [];
              let i = 0;

              const next = () => {
                if (i >= arr.length) return callback(null, arr);

                const obj = arr[i++];
                if (!obj || typeof obj !== 'object') {
                  return next();
                }

                const ks = Object.keys(obj);
                if (ks.length === 0) return next();

                const k = ks[0];
                const v = obj[k];

                distStore.append(v, {gid, key: k}, (appendErr) => {
                  if (appendErr) return callback(appendErr);
                  return next();
                });
              };

              return next();
            });
          } catch (err) {
            return callback(err);
          }
        },

        reduce: function(gid, mrID, callback) {
          try {
            const localStore = globalThis.distribution.local.store;
            const localRoutes = globalThis.distribution.local.routes;
            const localServiceName = `mr${mrID}`;

            localRoutes.get(localServiceName, (routeErr, svc) => {
              if (routeErr) return callback(routeErr);

              const reducer = svc && svc.reducer;
              const reduceKeys = Array.isArray(svc && svc.reduceKeys) ? svc.reduceKeys : [];
              const out = [];
              let i = 0;

              const next = () => {
                if (i >= reduceKeys.length) return callback(null, out);

                const key = reduceKeys[i++];
                localStore.get({gid, key}, (e, values) => {
                  if (e) {
                    const msg = String(e && e.message ? e.message : e);
  if (/ENOENT|no such file|not found for group|File .* not found/i.test(msg)) {
    return next();
  }
  return callback(e);
}

                  let reduced;
                  try {
                    reduced = reducer(key, Array.isArray(values) ? values : [values]);
                  } catch (err) {
                    return callback(err);
                  }

                  if (reduced && typeof reduced === 'object') {
                    out.push(reduced);
                  }

                  return next();
                });
              };

              return next();
            });
          } catch (err) {
            return callback(err);
          }
        },
      };

      groupRoutes.put(mrService, serviceName, (setupErr) => {
        if (hasRealError(setupErr)) {
          return callback(new Error(`MR setup error: ${inspect(setupErr, {depth: null})}`));
        }

        groupComm.send(
          [mrGid, mrID],
          {gid: 'local', service: serviceName, method: 'map'},
          (mapErr, mapValues) => {
            if (hasRealError(mapErr)) {
              return cleanupAndFinish(
                new Error(`MR map phase error: ${inspect(mapErr, {depth: null})}`),
                null
              );
            }

            mrService.reduceKeys = collectMappedKeys(mapValues);

groupRoutes.put(mrService, serviceName, (updateErr) => {
  if (hasRealError(updateErr)) {
    return cleanupAndFinish(
      new Error(`MR update phase error: ${inspect(updateErr, {depth: null})}`),
      null
    );
  }

  setupShuffleGroup((shuffleSetupErr) => {
    if (hasRealError(shuffleSetupErr)) {
      return cleanupAndFinish(
        new Error(`Shuffle group setup error: ${inspect(shuffleSetupErr, {depth: null})}`),
        null
      );
    }

    const shuffleStore = makeStore({gid: shuffleGid});
    const mappedItems = flattenCommValues(mapValues);
    let i = 0;

    const doShuffle = () => {
      if (i >= mappedItems.length) {
        const shuffleComm = dist[shuffleGid].comm;

        return shuffleComm.send(
          [shuffleGid, mrID],
          {gid: 'local', service: serviceName, method: 'reduce'},
          (reduceErr, reduceValues) => {
            if (hasRealError(reduceErr)) {
              throw new Error(`Reduce phase error: ${inspect(reduceErr, {depth: null})}`);
            }

            const finalOut = flattenCommValues(reduceValues);
            return cleanupAndFinish(null, finalOut);
          }
        );
      }

      const obj = mappedItems[i++];
      if (!obj || typeof obj !== 'object') {
        return doShuffle();
      }

      const ks = Object.keys(obj);
      if (ks.length === 0) {
        return doShuffle();
      }

      const k = ks[0];
      const v = obj[k];

      shuffleStore.append(v, {gid: shuffleGid, key: k}, (appendErr) => {
        if (hasRealError(appendErr)) {
          throw new Error(`Shuffle phase error: ${inspect(appendErr, {depth: null})}`);
        }
        return doShuffle();
      });
    };

    return doShuffle();
  });
});
          }
        );
      });
    } catch (err) {
      return callback(new Error(`MR exec crash: ${inspect(err, {depth: null})}`));
    }
  }

  return {exec};
}

module.exports = mr;