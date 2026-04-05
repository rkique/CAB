// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {string} [gid]
 *
 * @typedef {Object} Comm
 * @property {(message: any[], configuration: Target, callback: Callback) => void} send
 */

/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    callback = callback || (() => {});

    const distribution = globalThis.distribution;
    const localComm = distribution.local.comm;
    const localGroups = distribution.local.groups;

    const membershipGid = context.gid;

    const execGid = configuration.gid || 'local';

    let validationError = null;

    if (!Array.isArray(message)) {
      validationError = new Error('Message must be an array');
    } else if (!configuration || typeof configuration.service !== 'string') {
      validationError = new Error('Missing service');
    } else if (typeof configuration.method !== 'string') {
      validationError = new Error('Missing method');
    }

    localGroups.get(membershipGid, (ge, group) => {
      if (ge) return callback(ge, null);
      
      group = group || {};
      const sids = Object.keys(group);

      
      if (sids.length === 0) {
        return callback(new Error(`comm.send: empty group '${membershipGid}'`), null);
      }

      const values = /** @type {Record<string, any>} */ ({});
      const errors = /** @type {Record<string, Error>} */ ({});

      if (validationError) {
        for (const sid of sids) errors[sid] = validationError;
        return callback(errors,values);
      }

      let pending = sids.length;
      let finished = false;

      const finishifDone = () => {
        if (finished) return;
        if (pending !== 0) return;
        finished = true;
        callback(errors, values);
      };

      for (const sid of sids) {
        const node = group[sid];

        if (!node || typeof node.ip !== 'string' || typeof node.port === 'undefined') {
          errors[sid] = new Error('Invalid node in group');
          pending --;
          finishifDone();
          continue;
        }

        localComm.send(
          message,
          { node, gid: execGid, service: configuration.service, method: configuration.method },
          (e, v) => {
            if (e) errors[sid] = e;
            else values[sid] = v;
            pending--;
            finishifDone();
          }
        );
      }
    });
  }

  return {send};
}

module.exports = comm;
