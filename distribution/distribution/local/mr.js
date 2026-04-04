// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 */

/** @type {Map<string, {mapper: Function, reducer: Function, gid: string, keys: string[], coordinatorNode: object}>} */
const jobs = new Map();

/**
 * Register a MapReduce job on this node.
 * @param {string} mrID
 * @param {Function} mapper
 * @param {Function} reducer
 * @param {string} gid
 * @param {string[]} keys
 * @param {object} coordinatorNode
 * @param {Callback} callback
 */
function exec(mrID, mapper, reducer, gid, keys, coordinatorNode, callback) {
    jobs.set(mrID, {
        mapper,
        reducer,
        gid,
        keys: Array.isArray(keys) ? keys : [],
        coordinatorNode,
    });
    callback(null, mrID);
}

/**
 * Run the map phase for the given job on this node.
 * @param {string} mrID
 * @param {Callback} callback
 */
function map(mrID, callback) {
    const job = jobs.get(mrID);
    if (!job) return callback(new Error(`mr: unknown job ${mrID}`));
    const nid = distribution.util.id.getSID(distribution.node.config);
    //Get nodes corresponding to gid.
    distribution.local.groups.get(job.gid, (groupErr, nodes) => {
        if (groupErr) return callback(groupErr);
        const nids = Object.keys(nodes);
        const keys = (job.keys || []).filter((key) => {
            const keyID = distribution.util.id.getID(key);
            const ownerNid = distribution.util.id.consistentHash(keyID, nids);
            return ownerNid === nid;
        });

        const mapped = [];
        let idx = 0;

        function processNext() {
            //store mapped under ${mrID}_map key
            if (idx >= keys.length) {
                const mapOutConfig = { key: nid, gid: `${mrID}_map` };
                return distribution.local.store.put(mapped, mapOutConfig, (putErr) => {
                    if (putErr) return callback(putErr);
                    //write notify to coordinator when done
                    distribution.local.comm.send(
                        [{ phase: 'map', status: 'done', nid }],
                        { service: `mr-${mrID}`, method: 'notify', node: job.coordinatorNode },
                        (e) => callback(e || null, mapped),
                    );
                });
            }
            //iterate through provided kvs, performing mapper on each owner node.
            const key = keys[idx++];
            const hashedKey = distribution.util.id.getID(key);
            distribution.local.store.get({ key: hashedKey, gid: job.gid }, 
            (e, value) => {
                if (e) { return callback(new Error(`[mr map] failed to get key ${key} with error ${e}`)); }
                else {
                    try {
                        const out = job.mapper(key, value);
                        //handle array and object outputs.
                        if (Array.isArray(out)) {
                            mapped.push(...out);
                        } else if (typeof out === 'object') {
                            mapped.push(out);
                        }
                    } catch (mapperErr) {
                        return callback(mapperErr);
                    }
                } 
                processNext();
            });
        }
        processNext();
    });
}

/**
 * Run the shuffle phase for the given job on this node.
 * @param {string} mrID
 * @param {Callback} callback
 */
function shuffle(mrID, callback) {
    const job = jobs.get(mrID);
    if (!job) return callback(new Error(`mr: unknown job ${mrID}`));

    const nid = distribution.util.id.getSID(distribution.node.config);
    const mappedConfig = { key: nid, gid: `${mrID}_map` };
    distribution.local.store.get(mappedConfig, (getErr, mapped) => {
        if (getErr) return callback(new Error(`[mr shuffle]: ${getErr.message}`));
        const entries = mapped;
        distribution.local.groups.get(job.gid, (groupErr, nodes) => {
            if (groupErr) return callback(groupErr);
            const nids = Object.keys(nodes);
            const seenEmittedKeys = new Set();
            let idx = 0;
            //shuffle hashes each key to store.append in a relevant node.
            function appendNext() {
                if (idx >= entries.length) {
                    console.log(`[mr shuffle]: completed shuffle phase for job ${mrID} with ${entries.length} entries shuffled`);
                    return distribution.local.comm.send(
                        [{ phase: 'shuffle', status: 'done', nid }],
                        { service: `mr-${mrID}`, method: 'notify', node: job.coordinatorNode },
                        (e) => callback(e || null, []),
                    );
                }
                //determine correct destinationNode for nodes
                //This is done with consistentHashing
                const entry = entries[idx++];
                const emittedKey = Object.keys(entry)[0];
                const emittedValue = entry[emittedKey];
                const keyID = distribution.util.id.getID(emittedKey);
                const destinationNid = distribution.util.id.consistentHash(keyID, nids);
                const destinationNode = nodes[destinationNid];
                //reorganize the kv pair to the destinationNode
                distribution.local.comm.send(
                    [emittedValue, { key: emittedKey, gid: `${mrID}_shuffle` }],
                    { node: destinationNode, service: 'store', method: 'append' },
                    (appendErr) => {
                        if (appendErr) return callback(appendErr);
                        if (seenEmittedKeys.has(emittedKey)) {
                            return appendNext();
                        }
                        //ensure only one emitted key added to manifest.
                        seenEmittedKeys.add(emittedKey);
                        distribution.local.comm.send(
                            [emittedKey, { gid: `${mrID}_shuffle` }],
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
}

/**
 * Run the reduce phase for the given job on this node.
 * @param {string} mrID
 * @param {Callback} callback
 */
function reduce(mrID, callback) {
    const job = jobs.get(mrID);
    if (!job) return callback(new Error(`mr: unknown job ${mrID}`));
    const reduced = [];
    const nid = distribution.util.id.getSID(distribution.node.config);
    //get the reorganized kv pairs.
    distribution.local.store.get({gid: `${mrID}_shuffle` }, (keysErr, keyList) => {
        let keys = [];
        if (keysErr) {
            console.log(`[reduce] no keys found for job ${mrID} with error ${keysErr}`);
        } else { keys = [...new Set(keyList)] }
        //distribute the keys across the nodes to perform reduce, using consistent hashing.
        distribution.local.groups.get(job.gid, (groupErr, nodes) => {
            if (groupErr) return callback(groupErr);
            const nids = Object.keys(nodes);
            keys = keys.filter((key) => {
                const keyID = distribution.util.id.getID(key);
                const ownerNid = distribution.util.id.consistentHash(keyID, nids);
                return ownerNid === nid;
            });

            let idx = 0;
            //recursively enumerate indices to ensure sequence
            function processNext() {
                if (idx >= keys.length) {
                    //return reduced to the user via notify
                    return distribution.local.comm.send(
                        [{ phase: 'reduce', status: 'done', nid, results: reduced }],
                        { service: `mr-${mrID}`, method: 'notify', node: job.coordinatorNode },
                        (e) => callback(e, reduced));
                }
                const key = keys[idx++];
                distribution.local.store.get({ key, gid: `${mrID}_shuffle` }, (getErr, values) => {
                    if (getErr) { 
                        return callback(getErr);}
                    try {
                        const out = job.reducer(key, values);
                        reduced.push(out);
                        console.log(`[reduce] mr emitted ${JSON.stringify(out)} for key ${key}`);
                    } catch (reduceErr) {
                        return callback(reduceErr);
                    }
                    processNext();
                });
            }

            processNext();
        });
    });
}

module.exports = { exec, map, shuffle, reduce };
