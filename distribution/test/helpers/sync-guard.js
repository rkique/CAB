// @ts-check

/**
 * Wrap a callback-style function so sync throws become callback errors.
 * @param {Function} fn
 * @returns {Function}
 */
function wrapCallback(fn) {
  if (fn.__syncGuardWrapped) {
    return fn;
  }
  const wrapped = function(...args) {
    const callback = args[args.length - 1];
    try {
      return fn.apply(this, args);
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err);
        return;
      }
      throw err;
    }
  };
  wrapped.__syncGuardWrapped = true;
  return wrapped;
}

/**
 * @param {Object} service
 */
function wrapServiceMethods(service) {
  if (!service || typeof service !== 'object') {
    return;
  }
  for (const [key, value] of Object.entries(service)) {
    if (typeof value === 'function') {
      service[key] = wrapCallback(value);
    }
  }
}

/**
 * @param {Object} container
 */
function wrapServiceContainer(container) {
  if (!container || typeof container !== 'object') {
    return;
  }
  for (const value of Object.values(container)) {
    if (value && typeof value === 'object') {
      wrapServiceMethods(value);
    }
  }
}

/**
 * @param {Object} dist
 */
function wrapDistribution(dist) {
  if (!dist || typeof dist !== 'object') {
    return;
  }
  wrapServiceContainer(dist.local);
  wrapServiceContainer(dist.all);

  for (const [key, value] of Object.entries(dist)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (key === 'local' || key === 'all' || key === 'util' || key === 'node') {
      continue;
    }
    wrapServiceContainer(value);
  }
}

/**
 * Wrap local.groups.put so new group services are guarded too.
 * @param {Object} dist
 */
function wrapGroupCreation(dist) {
  if (!dist || !dist.local || !dist.local.groups) {
    return;
  }
  const groups = dist.local.groups;
  if (typeof groups.put !== 'function' || groups.put.__syncGuardGroupWrapped) {
    return;
  }
  const originalPut = groups.put;
  const wrappedPut = function(...args) {
    const callback = args[args.length - 1];
    try {
      const result = originalPut.apply(this, args);
      const config = args[0];
      const gid = typeof config === 'string' ? config : config && config.gid;
      if (gid && dist[gid]) {
        wrapServiceContainer(dist[gid]);
      }
      return result;
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err);
        return;
      }
      throw err;
    }
  };
  wrappedPut.__syncGuardWrapped = true;
  wrappedPut.__syncGuardGroupWrapped = true;
  groups.put = wrappedPut;
}

if (globalThis.distribution) {
  wrapDistribution(globalThis.distribution);
  wrapGroupCreation(globalThis.distribution);
}

module.exports = {};
