require('../../distribution.js')();
const distribution = globalThis.distribution;
const util = distribution.util;


//User Tests
test('serialize and deserialize zero arg function', () => { 
  let func = function() { return 42; };
  const serialized = util.serialize(func);
  const deserialized = util.deserialize(serialized);
  expect(typeof deserialized).toBe('function');
});

test('serialize and deserialize object with array', () => {
  let object = [{tr1: [1, "one"]}]
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(object);
});

test('nested object', () => {
  let object = {a: {b: {c: 3}}}
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(object);
});

test('Date object', () => {
  let object = new Date("2024-01-01T00:00:00Z")
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(object);
});

test('(3 pts) (scenario) 40 bytes object', () => {
  /*
          Come up with a JavaScript object, which when serialized,
          will result in a string that is 40 bytes in size.
      */
  let object = "helloworld.."
  const serialized = util.serialize(object);
  expect(serialized.length).toEqual(40);
});

test('(3 pts) (scenario) expected object', () => {
  /* Prepare an object so it results in an expected serialized string. */
  //idea: print out string.
  let object = {a: 2}
  let serializedObject = '{"type":"object","value":{"a":{"type":"number","value":"2"}}}'; /* Add here the expected serialized string by using util.serialize */
  expect(util.serialize(object)).toEqual(serializedObject);
});

test('(3 pts) (scenario) string deserialized into target object', () => {
  /*
          Come up with a string that when deserialized, results in the following object:
          {a: 1, b: "two", c: false}
      */

  let string = '{"type":"object","value":{"a":{"type":"number","value":"1"},"b":{"type":"string","value": "two"},"c": {"type":"boolean","value":"false"}}}'

  const object = {a: 1, b: 'two', c: false};
  const deserialized = util.deserialize(string);
  expect(object).toEqual(deserialized);
});

test('(3 pts) (scenario) object with all supported data types', () => {
/* Come up with an object that uses all valid (serializable)
    built-in data types supported by the serialization library. */
  let object = {a: [], b: new Date(), c: new Error(), d: {}, e: () => 1, f: null, g: 0, h: {}, i: "", j: undefined, k: true}
  
  const setTypes = [];
  for (const k in object) {
    setTypes.push(typeof object[k]);
    if (typeof object[k] == 'object' && object[k] != null) {
      setTypes.push(object[k].constructor.name);
    } else if (typeof object[k] == 'object' && object[k] == null) {
      setTypes.push('null');
    }
  }

  const typeList = setTypes.sort();
  const goalTypes = ['Array', 'Date', 'Error', 'Object',
    'boolean', 'function', 'null', 'number', 'object', 'string', 'undefined'];
  expect(typeList).toEqual(expect.arrayContaining(goalTypes));

  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).not.toBeNull();

  // Deleting functions because they are not treated as equivalent by Jest
  for (const k in object) {
    if (typeof object[k] == 'function') {
      delete object[k];
      delete deserialized[k];
    }
  }
  expect(deserialized).toEqual(object);
});

test('(3 pts) (scenario) malformed serialized string', () => {
/* Come up with a string that is not a valid serialized object. */

  let malformedSerializedString = 'QZ'

  expect(() => {
    util.deserialize(malformedSerializedString);
  }).toThrow(SyntaxError);
});


