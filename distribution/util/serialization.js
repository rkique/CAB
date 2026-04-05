// @ts-check

/**
 * @param {any} v
 * @returns {any}
 */


function enc(v) {

  if (v === null) return { t: 'null' };

  const ty = typeof v;

  if (ty === 'undefined') return { t: 'undef' };

  if (ty === 'number') {
    if (Number.isNaN(v)) return { t: 'num', s: 'NaN' };
    if (v === Infinity) return { t: 'num', s: 'Infinity' };
    if (v === -Infinity) return { t: 'num', s: '-Infinity' };
    return { t: 'num', s: String(v) };
  }

  if (ty === 'string') return { t: 'str', s: v };

  if (ty === 'boolean') return { t: 'bool', b: v };

  if (ty === 'function') {
    const src = v.toString();
    return { t: 'fn', src };
  }

  if (ty === 'object') {
    if (Array.isArray(v)) {
      return { t: 'arr', a: v.map(enc) };
    }

    if (v instanceof Date) {
      return { t: 'date', ms: v.getTime() };
    }

    if (v instanceof Error) {
      return { t: 'err', name: v.name, msg: v.message };
    }

    const o = {};
    for (const k in v) {
      o[k] = enc(v[k]);
    }
    return { t: 'obj', o };
  }

  throw new TypeError(`Cannot serialize type: ${ty}`);
}

function dec(node) {
  if (!node || typeof node !== 'object' || typeof node.t !== 'string') {
    throw new SyntaxError('Malformed serialized value');
  }

  switch (node.t) {
    case 'null': return null;
    case 'undef': return undefined;
    case 'num': {
      const s = node.s;
      if (s === 'NaN') return NaN
      if (s === 'Infinity') return Infinity;
      if (s === '-Infinity') return -Infinity;
      return Number(s);
  
    }
    case 'str': return node.s;
    case 'bool': return node.b;

    case 'fn': {
      const src = node.src;

      const f = eval(`(${src})`);
      if (typeof f !== 'function') throw new SyntaxError('Bad function');
      return f;
    }

    case 'arr': return node.a.map(dec);

    case 'date': return new Date(node.ms);

    case 'err': {
      const e = new Error(node.msg);
      if ( typeof node.name === 'string') e.name = node.name;
        return e;
    }

    case 'obj': {
      const out = {};
      for (const k in node.o) out[k] = dec(node.o[k]);
      return out;
    }
    default:
      throw new SyntaxError(`Unknown tag: ${node.t}`);
  }
}

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  return JSON.stringify(enc(object));
}


/**
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  if (typeof string !== 'string') {
    throw new Error(`Invalid argument type: ${typeof string}.`);
  }
  return dec(JSON.parse(string));
}

module.exports = {
  serialize,
  deserialize,
};
