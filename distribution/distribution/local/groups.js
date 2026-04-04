// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

let distribution = globalThis.distribution;
const nodeConfig = distribution.node.config;
const sid = distribution.util.id.getSID(nodeConfig);
  

/**
 * @param {string} name
 * @param {Callback} callback
 */
function get(name, callback) {
  //default callback 
  if (typeof callback !== 'function') {
    callback = function () { };
  }
  if (name === 'all') {
      let nodes = {};
      //for now just add local here
      let localConfig = distribution.node.config
      nodes[distribution.util.id.getSID(localConfig)] = localConfig;
      for (let key in distribution) {
        if (distribution[key] && distribution[key].nodes) {
          for (let gid in distribution[key].nodes) {
            nodes[gid] = distribution[key].nodes[gid];
          }
        }
      }
      return callback(null, nodes);
    }

    if (!distribution[name]) {
      return callback(new Error(`[local.groups] Group ${name} does not exist`))
    }

    return callback(null, distribution[name].nodes || {});
  }

  /**
   * @param {Config | string} config
   * @param {Object.<string, Node>} group
   * @param {Callback} callback
   */
  function put(config, group, callback) {
    if (typeof callback !== 'function') {
      callback = function () { };
    }

    if (typeof config === 'string') {
      config = { gid: config };
    }

    //distribution.local
    if (!distribution[config.gid]) {
      distribution[config.gid] = {};
    }

    distribution[config.gid].nodes = group;

    const allSetup = require('../all/all.js').setup;
    const groupServices = allSetup(config);
    for (let service in groupServices) {
      distribution[config.gid][service] = groupServices[service];
    }

    return callback(null, group);
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function del(name, callback) {

    if (typeof callback !== 'function') {
      callback = function () { };
    }
    if (!distribution[name]) {
      return callback(new Error('[del] group not found'));
    }
    const group = distribution[name].nodes
    delete distribution[name]
    return callback(null, group);
  }

  /**
   * @param {string} name
   * @param {Node} node
   * @param {Callback} callback
   */
  function add(name, node, callback) {
    //default callback 
    if (typeof callback !== 'function') {
      callback = function () { };
    }
    if (distribution[name]) {
      const group = distribution[name].nodes;
      group[distribution.util.id.getSID(node)] = node;
      return callback(null, group);
    } else {
      return callback(new Error(`[add] group ${name} not found`));
    }
  };

  /**
   * @param {string} name
   * @param {string} node
   * @param {Callback} callback
   */
  function rem(name, node, callback) {
    //default callback 
    if (typeof callback !== 'function') {
      callback = function () { };
    }
    if (distribution[name]) {
      const group = distribution[name].nodes;
      delete group[node];
      return callback(null, group);
    }
    else {
      //return callback(null, null)
      return callback(new Error('[rem] group not found'));
    }
  };

  module.exports = { get, put, del, add, rem };