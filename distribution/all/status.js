// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Status
 * @property {(configuration: string, callback: Callback) => void} get
 * @property {(configuration: Node, callback: Callback) => void} spawn
 * @property {(callback: Callback) => void} stop
 */

// const { group } = require("yargs");
// const local = require("../local/local.js");

/**
 * @param {Config} config
 * @returns {Status}
 */
function status(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    callback = callback || (() => {});

    const distribution = globalThis.distribution;

    const groupServices = distribution[context.gid];
    if(!groupServices || !groupServices.comm || typeof groupServices.comm.send !== 'function') {
      return callback(new Error(`Missing comm for gid=${context.gid}`), null);
    }

    groupServices.comm.send(
      [configuration],
      {service: 'status', method: 'get', gid: 'local'},
      (groupErrs, valuesMap) => {
        const errs = /** @type {Record<string, Error>} */ (groupErrs || {});
        valuesMap = valuesMap || {};

        if (Object.keys(valuesMap).length === 0 && Object.keys(errs).length > 0) {
          return callback(errs, {});
        }

        let out;

        if(configuration === 'heapTotal' || configuration === 'heapUsed' || configuration === 'counts') {
          let sum = 0;
          for (const sid of Object.keys(valuesMap)) {
            const v = valuesMap[sid];
            if (typeof v === 'number' && Number.isFinite(v)) sum +=v;
          }
          out = sum;
        } else if (configuration === 'nid' || configuration === 'sid') {
          out = Object.values(valuesMap);
        } else {
          out = Object.values(valuesMap);
        }

        return callback(errs, out);
      }
    );
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    callback = callback || (() =>{});

    const distribution = globalThis.distribution;

    const localStatus = distribution.local.status;
    const localGroups = distribution.local.groups;
    const localComm = distribution.local.comm;
    const id = distribution.util.id;

    if(!configuration || typeof configuration.ip !== 'string' || typeof configuration.port === 'undefined') {
      return callback(new Error('status.spawn: invalid node configuration'), null);
    }

    localStatus.spawn(configuration, (se, sv) => {
      if (se) return callback(se, null);

      localGroups.get(context.gid, (ge, group) => {
        if (ge) return callback(ge, null);
    

        group = group || {};

      const newSid = 
        (id && typeof id.getSID === 'function' && id.getSID(configuration)) ||
        (id && typeof id.getNID === 'function' && id.getNID(configuration)) ||
        `${configuration.ip}:${configuration.port}`;

      const updated = Object.assign({}, group);
      updated[newSid] = { ip: configuration.ip, port: configuration.port };


      const targets = Object.assign({}, updated);
      const sids = Object.keys(targets);

      const values = /** @type {Record<string, any>} */ ({});
      const errors = /** @type {Record<string, Error>}*/ ({});

      if (sids.length === 0) {
        return callback(null, updated);
      }

      let pending = sids.length;
      let finished = false;

      const finishIfDone = () => {
        if (finished) return;
        if (pending !== 0) return;
        finished = true;
        const errOut = Object.keys(errors).length ? errors : /** @type {any } */ (null);

        callback(errOut, updated);
      };

      for (const sid of sids) {
        const node = targets[sid];

        if (!node || typeof node.ip !== 'string' || typeof node.port === 'undefined') {
          errors[sid] = new Error('status.spawn: invalid node in target set');
          pending--;
          finishIfDone();
          continue;
        }

        localComm.send(
          [context.gid, updated],
          { node, gid: 'local', service: 'groups', method: 'put' },
          (e, v) => {
            if (e) errors[sid] = e;
            else values[sid] = v;
            pending--;
            finishIfDone();
          }
        );
      }
    });
  });
}

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    callback = callback || (() => {});

    const distribution = globalThis.distribution;

    const localGroups = distribution.local.groups;
    const localComm = distribution.local.comm;
    const id = distribution.util.id;

    const self = distribution.node.config;
    const selfSid = 
      (id && typeof id.getSID === 'function' && id.getSID(self)) ||
      (id && typeof id.getNID === 'function' && id.getNID(self)) ||
      `${self.ip}:${self.port}`;
    
    localGroups.get(context.gid, (ge, group) => {
      if (ge) return callback(ge, null);

      group = group || {};
      const sids = Object.keys(group).filter(sid => sid !== selfSid);

      const values = /** @type {Record<string, any>} */ ({});
      const errors = /** @type {Record<string, Error>} */ ({});

      if (sids.length === 0) {
        return callback(null, values);
      }

      let pending = sids.length;
      let finished = false;

      const finishIfDone = () => {
        if (finished) return;
        if (pending !== 0) return;
        finished = true;
        const errOut = Object.keys(errors).length ? errors : /** @type {any} */ (null);
        callback(errOut, values);
      };

      for (const sid of sids) {
        const node = group[sid];

        if (!node || typeof node.ip !== 'string' || typeof node.port === 'undefined') {
          errors[sid] = new Error('status.stop: invalid node in group');
          pending--;
          finishIfDone();
          continue;
        }

        localComm.send(
          [],
          {node, gid: 'local', service: 'status', method: 'stop' },
          (e, v) => {
            if (e) errors[sid] = e;
            else values[sid] = v;
            pending--;
            finishIfDone();
          }
        );
      }
    });
  }

  return {get, stop, spawn};
}

module.exports = status;
