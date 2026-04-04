// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").NID} NID
 */

const id = require('../util/id.js');

//note that map goes from (string, any) to object[]
/**
 * Map functions used for mapreduce
 * @callback Mapper
 * @param {string} key
 * @param {any} value
 * @returns {object[]}
 */

//note that reduce goes from (string,any[]) to object.
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

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  /**
   * all.comm returns {} when no node-level errors occurred.
   * Treat only actual Error or non-empty error maps as failures.
   * @param {any} err
   * @returns {boolean}
   */
  function hasRealError(err) {
    if (!err) return false;
    if (err instanceof Error) return true;
    if (typeof err === 'object') {
      const keys = Object.keys(err);
      if (keys.length === 0) return false;
      // Treat maps like {nid: {}} as no-error placeholders.
      return Object.values(err).some((value) => {
        if (!value) return false;
        if (value instanceof Error) return true;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
      });
    }
    return true;
  }

  const id = globalThis.distribution.util.id;
  /**
   * Build a per-job worker service to run on each node.
   * @returns {{exec: Function, map: Function, shuffle: Function, reduce: Function}}
   */
  function buildMRService() {
    return {
      exec: function(mrID, mapper, reducer, gid, keys, coordinatorNode, callback) {
        const jobs = globalThis.__mrDynamicJobs || (globalThis.__mrDynamicJobs = new Map());
        jobs.set(mrID, {
          mapper,
          reducer,
          gid,
          keys: Array.isArray(keys) ? keys : [],
          coordinatorNode,
        });
        callback(null, mrID);
      },

      //map function gets an mrID and returns the respective mapped values to frontend.
      map: function(mrID, callback) {
        const jobs = globalThis.__mrDynamicJobs || (globalThis.__mrDynamicJobs = new Map());
        const job = jobs.get(mrID);
        if (!job) return callback(new Error(`mr: unknown job ${mrID}`));
        const nid = id.getSID(globalThis.distribution.node.config);

        globalThis.distribution.local.groups.get(job.gid, (err, nodes) => {
          if (err) return callback(new Error(`[map] produced groups.get error: ${err}`));

          const nids = Object.keys(nodes);

          const keys = job.keys.filter((key) => {
            const keyID = id.getID(key);
            const ownerNid = id.consistentHash(keyID, nids);
            return ownerNid === nid;
          });

          const mapped = [];
          let idx = 0;
          //asynchronous calls to avoid sync issues.
          function processNext() {
            if (idx >= keys.length) {
              const mapOutConfig = { key: `${nid}_map`, gid: job.gid };
              return globalThis.distribution.local.store.put(mapped, mapOutConfig, (putErr) => {
                if (putErr) return callback(putErr);
                globalThis.distribution.local.comm.send(
                    [{ phase: 'map', status: 'done', nid }],
                    { service: `mr-${mrID}`, method: 'notify', node: job.coordinatorNode },
                    (notifyErr) => callback(notifyErr, mapped),
                );
              });
            }

            const key = keys[idx++];
            const hashedKey = id.getID(key);
            globalThis.distribution.local.store.get({ key: hashedKey, gid: job.gid }, (getErr, value) => {
              if (getErr) {
                return callback(new Error(`[map] failed to get key ${key} with error ${getErr}`));
              }
              try {
                const emitted = job.mapper(key, value);
                if (Array.isArray(emitted)) {
                  mapped.push(...emitted);
                } else if (emitted != null) {
                  mapped.push(emitted);
                }
              } catch (mapperErr) {
                return callback(new Error(`[map] failed to map key ${key} with error ${mapperErr}`));
              }
              processNext();
            });
          }
          processNext();
        });
      },

      shuffle: function(mrID, callback) {
        let jobs = globalThis.__mrDynamicJobs || (globalThis.__mrDynamicJobs = new Map());
        const job = jobs.get(mrID);
        if (!job) return callback(new Error(`mr: unknown job ${mrID}`));

        const id = globalThis.distribution.util.id;
        const nid = id.getSID(globalThis.distribution.node.config);
        const mapInConfig = { key: `${nid}_map`, gid: job.gid };
        const shuffleKeysIndex = `__${mrID}_shuffle_keys`;
        //we retrieve keys corresponding to the `mapped` prop.
        globalThis.distribution.local.store.get(mapInConfig, (err, mapped) => {
          if (err) return callback(new Error(`[mr shuffle]: ${err.message}`));

          globalThis.distribution.local.groups.get(job.gid, (groupErr, nodes) => {
            if (groupErr) return callback(groupErr);

            const nids = Object.keys(nodes);
            let idx = 0;

            function appendNext() {
              if (idx >= mapped.length) {
                return globalThis.distribution.local.comm.send(
                    [{ phase: 'shuffle', status: 'done', nid }],
                    { service: `mr-${mrID}`, method: 'notify', node: job.coordinatorNode },
                    (notifyErr) => callback(notifyErr || null, []),
                );
              }
              //determine the destination node for the emitted key and send the value there to be stored under the emitted key and mrID.
              const entry = mapped[idx++];
              const emittedKey = Object.keys(entry)[0];
              const shuffleValueKey = `${emittedKey}_shuffle`;
              const keyID = id.getID(emittedKey);
              const destinationNid = id.consistentHash(keyID, nids);
              const destinationNode = nodes[destinationNid];

              globalThis.distribution.local.comm.send(
                  [entry[emittedKey], { key: shuffleValueKey, gid: job.gid }],
                  { node: destinationNode, service: 'store', method: 'append' },
                  (appendErr) => {
                    if (appendErr) return callback(appendErr);
                    globalThis.distribution.local.comm.send(
                        [emittedKey, { key: shuffleKeysIndex, gid: job.gid }],
                        { node: destinationNode, service: 'store', method: 'append' },
                        (keyAppendErr) => {
                          if (keyAppendErr) return callback(keyAppendErr);
                          appendNext();
                        },
                    );
                  },
              );
            }

            appendNext();
          });
        });
      },
      //applies reduce to the correct node.
      reduce: function(mrID, callback) {
        const jobs = globalThis.__mrDynamicJobs || (globalThis.__mrDynamicJobs = new Map());
        const job = jobs.get(mrID);
        if (!job) return callback(new Error(`mr: unknown job ${mrID}`));

        const id = globalThis.distribution.util.id;
        const nid = id.getSID(globalThis.distribution.node.config);
        const reduced = [];
        const shuffleKeysIndex = `__${mrID}_shuffle_keys`;
        //get all the keys that were emitted in the shuffle phase to be reduced by this node.
        globalThis.distribution.local.store.get({ key: shuffleKeysIndex, gid: job.gid }, (keysErr, keyList) => {
          
          let keys = [...new Set(keyList)];
          globalThis.distribution.local.groups.get(job.gid, (groupErr, nodes) => {
            if (groupErr) return callback(new Error(`reduce.groupErr: ${groupErr}`));

            const nids = Object.keys(nodes);
            keys = keys.filter((key) => {
              const keyID = id.getID(key);
              const ownerNid = id.consistentHash(keyID, nids);
              return ownerNid === nid;
            });

            let idx = 0;
            function processNext() {
              if (idx >= keys.length) {
                return globalThis.distribution.local.comm.send(
                    [{ phase: 'reduce', status: 'done', nid, results: reduced }],
                    { service: `mr-${mrID}`, method: 'notify', node: job.coordinatorNode },
                    (notifyErr) => callback(notifyErr, reduced),
                );
              }

              const key = keys[idx++];
              globalThis.distribution.local.store.get({ key: `${key}_shuffle`, gid: job.gid }, (valueErr, values) => {
                if (valueErr) return callback(valueErr);
                try {
                  reduced.push(job.reducer(key, values));
                } catch (reduceErr) {
                  return callback(reduceErr);
                }
                processNext();
              });
            }

            processNext();
          });
        });
      },
    };
  }


  /**
   * @param {MRConfig} configuration
   * @param {Callback} callback
   * @returns {void}
   */
  function exec(configuration, callback) {
    const mrID = id.getID(`${configuration}${Date.now()}`);
    const coordinatorServiceName = `mr-${mrID}`;
    const workerServiceName = `mrw-${mrID}`;
    const coordinatorNode = distribution.node.config;

    // State tracked by the coordinator across all workers.
    const state = {
      nodes: [],
      mapDones: 0,
      shuffleDones: 0,
      reduceDones: 0,
      mergedResults: [],
      finished: false,
    };

    const coordinatorService = {
      notify: function(payload, notifyCallback) {

        if (typeof notifyCallback === 'function') {
          notifyCallback(null, null);
        }
        if (state.finished) return;

        const { phase, status, results } = payload;
        console.log(`context.gid: ${context.gid}`);
        if (phase === 'map' && status === 'done') {
          state.mapDones++;
          if (state.mapDones === state.nodes.length) {
            console.log(`[MR NOTIFY] MAP DONE`);
            distribution[context.gid].comm.send(
              [mrID], { service: workerServiceName, method: 'shuffle' }, () => {});
          }
          return;
        }

        if (phase === 'shuffle' && status === 'done') {
          state.shuffleDones++;
          if (state.shuffleDones === state.nodes.length) {
            console.log(`[MR NOTIFY] SHUFFLE DONE`);
            distribution[context.gid].comm.send(
              [mrID], { service: workerServiceName, method: 'reduce' }, () => {});
          }
          return;
        }

        if (phase === 'reduce' && status === 'done') {
          state.reduceDones++;
          // console.log(`[MR NOTIFY] REDUCE DONE with results ${JSON.stringify(results)}`);
          const reduceResults = Array.isArray(results) ? results : [];
          state.mergedResults.push(...reduceResults);

          if (state.reduceDones === state.nodes.length) {
            state.finished = true;
            distribution.local.routes.rem(coordinatorServiceName, () => {});
            distribution[context.gid].comm.send(
                [workerServiceName],
                { service: 'routes', method: 'rem' },
                () => {},
            );
            console.log(`[MR COMPLETE] with merged results ${JSON.stringify(state.mergedResults)}`);
            callback(null, state.mergedResults);
          }
        }
      },
    };
    console.log(`context.gid: ${context.gid}`)
    console.log(``)
    distribution.local.groups.get(context.gid, (err, nodes) => {
      if (err) {
        return callback(null, new Error(`mr: failed to get groups with error ${err}`));
      }
      state.nodes = Object.keys(nodes);
      if (state.nodes.length === 0) return callback(null, []);

      distribution.local.routes.put(coordinatorService, coordinatorServiceName, (routeErr) => {
        if (routeErr) {
          return callback(null, new Error(`mr: failed to register coordinator service with error ${routeErr}`));
        }
        //we want to register workerServiceName within the current routes object. 
        const workerService = buildMRService();
        //we push the workerServiceName: workerService to the remote node.
        distribution[context.gid].comm.send(
            [workerService, workerServiceName],
            { service: 'routes', method: 'put' },
            (registerErr) => {
              if (hasRealError(registerErr)) {
                return callback(null, new Error(`mr: failed to register worker service with error ${JSON.stringify(registerErr)}`));
              }
              distribution[context.gid].comm.send(
                  [
                    mrID,
                    configuration.map,
                    configuration.reduce,
                    context.gid,
                    configuration.keys,
                    coordinatorNode,
                  ],
                  { service: workerServiceName, method: 'exec' },
                  (execErr) => {
                      if (hasRealError(execErr)) {
                      return callback(null, new Error(`mr: failed to send exec message with error ${execErr} ${JSON.stringify(execErr)}`));
                    }

                    distribution[context.gid].comm.send(
                        [mrID],
                        { service: workerServiceName, method: 'map' },
                        (mapErr) => {
                              if (mapErr && typeof mapErr === 'object') {
                                const mapErrDetails = Object.fromEntries(
                                    Object.entries(mapErr).map(([nodeId, value]) => {
                                      if (value instanceof Error) {
                                        return [nodeId, {
                                          isError: true,
                                          name: value.name,
                                          message: value.message,
                                          stack: value.stack,
                                        }];
                                      }
                                      if (!value) {
                                        return [nodeId, { isError: false, value: value }];
                                      }
                                      return [nodeId, {
                                        isError: false,
                                        type: typeof value,
                                        keys: typeof value === 'object' ? Object.keys(value) : undefined,
                                        value: value,
                                      }];
                                    }),
                                );
                                console.log(`[MR mapErr details] ${JSON.stringify(mapErrDetails)}`);
                              }
                          if (hasRealError(mapErr)) {
                            callback(null, new Error(`mr: failed to send map message with error ${Object.fromEntries(Object.entries(mapErr).map(([k,v]) => [k, { isError: v instanceof Error, name: v?.name, message: v?.message }]))}, stringifyed ${JSON.stringify(mapErr)}`));
                          }
                        },
                    );
                  },
              );
            },
        );
      });
    });
  }
  return { exec };
}

module.exports = mr;
