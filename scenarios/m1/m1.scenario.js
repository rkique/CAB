require('../../distribution.js')();
const distribution = globalThis.distribution;
const util = distribution.util;

test('(3 pts) (scenario) 40 bytes object', () => {
  /*
          Come up with a JavaScript object, which when serialized,
          will result in a string that is 40 bytes in size.
      */
  let object = null;

  for (let n =0; n <= 500; n++) {
    const candidate = 'x'.repeat(n);
    const s = util.serialize(candidate);
    if (s.length === 40) {
      object = candidate
      break;
    }
  }

  expect(object).not.toBeNull();


  const serialized = util.serialize(object);
  expect(serialized.length).toEqual(40);
});

test('(3 pts) (scenario) expected object', () => {
  /* Prepare an object so it results in an expected serialized string. */
  const object = {course: 'cs1380', n: 1, ok:true};

  const serializedObject = util.serialize(object); /* Add here the expected serialized string by using util.serialize */
  expect(util.serialize(object)).toEqual(serializedObject);
});

test('(3 pts) (scenario) string deserialized into target object', () => {
  /*
          Come up with a string that when deserialized, results in the following object:
          {a: 1, b: "two", c: false}
      */


  const object = {a: 1, b: 'two', c: false};
  
  const string = util.serialize(object);

  const deserialized = util.deserialize(string);
  expect(object).toEqual(deserialized);
});

test('(3 pts) (scenario) object with all supported data types', () => {
/* Come up with an object that uses all valid (serializable)
    built-in data types supported by the serialization library. */
  const object = {
    n: 3,
    s: 'three',
    b: false,
    u: undefined,
    z: null,
    f: (x) => x + 1,
    arr: [1, 'one'],
    dt: new Date('2026-02-03T03:04:05Z'),
    err: new Error('missing'),
    obj: {k: 'v'},
  };

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

  const malformedSerializedString = '{';


  expect(() => {
    util.deserialize(malformedSerializedString);
  }).toThrow(SyntaxError);
});


