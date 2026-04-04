// @ts-check
/**
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").ID} ID
 * @typedef {import("../types.js").NID} NID
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Hasher} Hasher
 */

const assert = require('assert');
const crypto = require('crypto');

/**
 * @param {any} obj
 * @returns {ID}
 */
function getID(obj) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(obj));
  return hash.digest('hex');
}

/**
 * The NID is the SHA256 hash of the JSON representation of the node
 * @param {Node} node
 * @returns {NID}
 */
function getNID(node) {
  node = {ip: node.ip, port: node.port};
  return getID(node);
}

/**
 * The SID is the first 5 characters of the NID
 * @param {Node} node
 * @returns {SID}
 */
function getSID(node) {
  return getNID(node).substring(0, 5);
}

/**
 * @param {any} message
 * @returns {string}
 */
function getMID(message) {
  const msg = {};
  msg.date = new Date().getTime();
  msg.mss = message;
  return getID(msg);
}

/**
 * @param {string} id
 * @returns {bigint}
 */
function idToNum(id) {
  assert(typeof id === 'string', 'idToNum: id is not in KID form!');
  const trimmed = id.startsWith('0x') ? id.slice(2) : id;
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(`0x${trimmed}`);
  }
  return BigInt(id);
}

/** @type { Hasher } */
//Given a key identifier and node ids (could be nodes), choose the NID at the modulo of KID 
const naiveHash = (kid, nids) => {
  // console.log(`[naiveHash] kid: ${kid}, nids: ${nids}`);
  const sortedNids = [...nids].sort();
  const index = Number(idToNum(kid) % BigInt(sortedNids.length));
  return sortedNids[index];
};

/** @type { Hasher } */
const consistentHash = (kid, nids) => {
  // console.log(`[consistentHash] kid: ${kid}, nids: ${nids}`);
  const kidNum = idToNum(kid);
  const nidNums = nids.map(nid => idToNum(nid));
  const sortedNidNums = [...nidNums].sort((a, b) => a > b ? 1 : -1);

  let index = sortedNidNums.findIndex(nidNum => nidNum >= kidNum);
  if (index === -1) index = 0;

  return nids[nidNums.indexOf(sortedNidNums[index])];
  
};

/** @type { Hasher } */
const rendezvousHash = (kid, nids) => {
  let mergedList = []

  nids.forEach((nid) => mergedList.push(kid + nid))
  mergedList.forEach((element, i) => {
    mergedList[i] = idToNum(getID(element))
  })

  const maxIndex = mergedList.reduce((mi, cv, ci, arr) => {
    if (cv > arr[mi]) return ci;
    else return mi;
  }, 0);

  return nids[maxIndex];

};

module.exports = {
  getID,
  getNID,
  getSID,
  getMID,
  naiveHash,
  consistentHash,
  rendezvousHash,
};
