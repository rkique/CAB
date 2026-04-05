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
const naiveHash = (kid, nids) => {
  const sortedNids = [...nids].sort();
  const index = Number(idToNum(kid) % BigInt(sortedNids.length));
  return sortedNids[index];
};

/** @type { Hasher } */
const consistentHash = (kid, nids) => {
  const kidNum = idToNum(kid);

  const ring = nids.map((nid) => ({num: idToNum(nid), nid }));
  ring.push({ num: kidNum, nid: null});

  ring.sort((a,b) => (a.num < b.num ? -1: a.num > b.num ? 1 : 0));

  const kidIndex = ring.findIndex((x) => x.nid === null);
  
  let i = (kidIndex + 1) % ring.length;

  while (ring[i].nid === null) {
    i = (i + 1) % ring.length;
  }
  return ring[i].nid;
};

/** @type { Hasher } */
const rendezvousHash = (kid, nids) => {

  let bestNid = null;
  let bestScore = null;

  for (const nid of nids) {
    const combined = kid + nid;
    const h = getID(combined);
    const score = idToNum(h);

    if (bestScore === null || score > bestScore) {
      bestScore = score;
      bestNid = nid;
    }
  }
  return bestNid;

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
