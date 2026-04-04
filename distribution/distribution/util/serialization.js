// @ts-check

const assert = require('assert');
const { type } = require('os');

const id = (() => {
  let currentId = 0;
  const map = new WeakMap();

  return (object) => {
    if (!map.has(object)) {
      map.set(object, ++currentId);
    }

    return map.get(object);
  };
})();

let nativeFuncs = {
  '0': global.console.log, 
  '1': require('fs').readFile, 
  '2': require('os').type, 
  '3': require('fs').readFileSync, 
  '4': require('path').join
}

function serializeWithUEID(object, seenSet) {
  //Number, String, Boolean
  const primitives = ["number", "string", "boolean", "bigint"]
  // Handle null
  if (object === null) {
    return JSON.stringify(null);
  }
  //Handle undefined
  else if (typeof object === 'undefined') {
    return JSON.stringify({ type: 'undefined', value: '' })
  }
  //Handle function
  else if (typeof object === 'function') {
    function extractFunctionParts(func) {
      const funcStr = func.toString();
      //arrow case
      if (funcStr.includes('=>')) {
        const arrowIndex = funcStr.indexOf('=>');
        let paramsPart = funcStr.slice(0, arrowIndex).trim();
        let bodyPart = funcStr.slice(arrowIndex + 2).trim();
        paramsPart = paramsPart.replace(/^\(|\)$/g, '');
        //[case] single parameter without parentheses
        const args = paramsPart ? paramsPart.split(',').map(p => p.trim()) : [];
        //[case] one line implicit return
        if (!bodyPart.startsWith('{')) {
          bodyPart = `return ${bodyPart};`;
        } else {
          bodyPart = bodyPart.slice(1, -1).trim();
        }
        return { args, body: bodyPart };
      } else {
        // Regular function matching args.
        const argsMatch = funcStr.match(/\(([^)]*)\)/);
        //checks if capture group caught splits the string to produce args. 
        const args = argsMatch && argsMatch[1]
          ? argsMatch[1].split(',').map(arg => arg.trim()).filter(Boolean)
          : [];
        const bodyMatch = funcStr.match(/\{([\s\S]*)\}/);
        const body = bodyMatch ? bodyMatch[1].trim() : '';
        return { args, body };
      }
    }
    // Check if native function
    const nativeId = Object.keys(nativeFuncs).find(key => nativeFuncs[key] === object);
    if (nativeId) {
      const wrappedNative = {
        type: "native",
        value: nativeId
      };
      return JSON.stringify(wrappedNative);
    }
    // Regular function
    const { args, body } = extractFunctionParts(object);

    const wrappedFunction = {
      type: "function",
      args: args,
      body: body
    };
    return JSON.stringify(wrappedFunction);
  }
  //Handle Error
  else if (object instanceof Error) {
    const errorProps = {};
    Object.getOwnPropertyNames(object).forEach(function (key) {
      errorProps[key] = object[key];
    });
    const wrappedError = {
      type: "error",
      value: JSON.stringify(errorProps)
    }
    return JSON.stringify(wrappedError);
  }
  //Handle Date
  else if (object instanceof Date) {
    const wrappedDate = {
      type: "date",
      value: object.toISOString()
    }
    return JSON.stringify(wrappedDate)
  }
  //Handle array (give array ID)
  else if (Array.isArray(object)) {
    const objId = id(object);
    if (seenSet.has(objId)) {
      return JSON.stringify({ type: "reference", value: objId });
    }
    seenSet.add(objId);
    let serializedDict = {}
    for (var i = 0; i < object.length; i++) {
      serializedDict[`${i}`] = serializeWithUEID(object[i], seenSet)
    }
    const wrappedArray = {
      type: "array",
      id: objId,
      value: serializedDict
    }
    return JSON.stringify(wrappedArray)
  }
  //Handle primitives
  else if (primitives.includes(typeof object)) {
    let value = object.toString()
    const wrapped = {
      type: typeof object,
      value: value
    }
    return JSON.stringify(wrapped);
  }
  //Handle object (give object ID)
  else {
    const objId = id(object);
    if (seenSet.has(objId)) {
      return JSON.stringify({ type: "reference", value: objId });
    }
    seenSet.add(objId);
    let serializedDict = {}
    for (let key of Object.keys(object)) {
      serializedDict[key] = serializeWithUEID(object[key], seenSet)
    }
    const wrappedObject = {
      type: "object",
      id: objId,
      value: serializedDict
    }
    return JSON.stringify(wrappedObject)
  }
}

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  let seenSet = new Set()
  return serializeWithUEID(object, seenSet) 
}

function deserializeWithMap(string, objectMap) {
  if (typeof string !== 'string') {
    throw new Error(`Invalid argument type: ${typeof string}.`);
  }
  let parsed = JSON.parse(string);
  if (parsed == null) return null
  if (parsed.type == 'undefined') return undefined
  if (parsed.type == 'function') {
    const func = new Function(...parsed.args, parsed.body);
    return func;
  }
  let serializedDict;
  switch (parsed.type) {
    case "reference":
      return objectMap.get(parsed.value);
    case "native":
      return nativeFuncs[parsed.value];
    case 'error':
      const errorObj = JSON.parse(parsed.value);
      const error = new Error();
      Object.assign(error, errorObj);
      return error;
    case 'date':
      return new Date(parsed.value);
    case 'array':
      serializedDict = parsed.value
      const length = Object.keys(serializedDict).length
      const arr = new Array(length);
      if (parsed.id) { objectMap.set(parsed.id, arr)}
      for (let i = 0; i < length; i++) {
        arr[i] = deserializeWithMap(serializedDict[i], objectMap);
      }
      return arr;
    case 'number':
      return Number(parsed.value);
    case 'string':
      return String(parsed.value);
    case 'boolean':
      return parsed.value === 'true';
    case 'bigint':
      return BigInt(parsed.value);
    case 'object':
      serializedDict = parsed.value
      let deserializedObject = {}
      if (parsed.id) { objectMap.set(parsed.id, deserializedObject)}
      //set the deserializedObject with the right keys.
      for (let key of Object.keys(serializedDict)) {
        deserializedObject[key] = deserializeWithMap(serializedDict[key], objectMap)
      }
      return deserializedObject
    default:
      throw new Error(`Unsupported type during deserialization: ${parsed.type}`);
  }
}

//arrays, objects are stored in objectMap by ID
// their children may be the parent themselves.
/**
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  const objectMap = new Map();
  return deserializeWithMap(string, objectMap);
}

module.exports = {
  serialize,
  deserialize,
};
