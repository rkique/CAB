require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const util = distribution.util;

const fs = require('fs');

beforeAll(() => {
  const original = {a: 1, b: 2, c: 3};
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).not.toBe(original);
});

test('(5 pts) serializeCircularObject', () => {
  const object = {a: 1, b: 2, c: 3};
  object.self = object;
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(object);
});

test('(5 pts) serializeNativeFunction', () => {
  const fn = fs.readFile;
  const serialized = util.serialize(fn);
  const deserialized = util.deserialize(serialized);
  // Native function serialization might not work as expected
  expect(deserialized).toBe(fs.readFile);
});

test('(5 pts) serializeAnotherNativeFunction', () => {
  const fn = require('console').log;
  const serialized = util.serialize(fn);
  const deserialized = util.deserialize(serialized);
  // Native function serialization might not work as expected
  expect(deserialized).toBe(fn);
});

test('(5 pts) serializeObjectWithNativeFunctions', () => {
  const object = {a: fs.readFile};
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  // Native function serialization might not work as expected
  expect(deserialized.a).toBe(fs.readFile);
});

test('(5 pts) serializeRainbowObjectCirc', () => {
  const object = {
    n: 1,
    s: 'Hello, World!',
    a: [1, 2, 3, 4, 5],
    e: new Error('Hello, World!'),
    d: new Date(),
    o: {x: 1, y: 2, z: 3},
    n: null,
    u: undefined,
  };

  object.self = object;

  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);

  expect(deserialized).toEqual(object);
});

test('(0 pts) serialize and deserialize preserves cyclic references', () => {
  const original = {};
  original.self = original;
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized.self).toBe(deserialized);
});

test('(0 pts) cyclic linked list', () => {
  const head = {val: 3, next: null};
  head.next = {val: 5, next: null};
  const succ = head.next;
  succ.next = head;
  const serialized = util.serialize(head);
  const deserialized = util.deserialize(serialized);
  expect(deserialized.val).toBe(3);
  expect(deserialized.next.val).toBe(5);
  expect(deserialized.next.next).toBe(deserialized);
});

test('(0 pts) cyclic array linked list', () => {
  const list = [];
  list[0] = {val: 3, next: null};
  list[1] = list[0];
  list[0].next = list[1];
  const serialized = util.serialize(list);
  const deserialized = util.deserialize(serialized);
  expect(deserialized[0].val).toBe(3);
  expect(deserialized[1]).toBe(deserialized[0]);
  expect(deserialized[0].next).toBe(deserialized[1]);
});

test('(0 pts) deserializeReference follows nested paths', () => {
  const original = {a: {}};
  original.a.self = original.a;
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized.a.self).toBe(deserialized.a);
});

test('(5 pts) serialize and deserialize structure with cycle-like reference', () => {
  const x = {a: 1, b: 2, c: 3};
  const original = {a: x, b: x};
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);

  expect(deserialized).toEqual(original);
});

test('(5 pts) serialize and deserialize cyclic structure with function', () => {
  const f = function f() {};
  const original = [f, f];
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(Array.isArray(deserialized)).toEqual(true);
  expect(typeof deserialized[0] === 'function').toEqual(true);
  expect(deserialized[0].name).toEqual('f');
});

test('(5 pts) serialize and deserialize object with function', () => {
  const f = function f() {};
  const original = {a: f, b: f};
  let serialized = util.serialize(original);
  serialized = util.deserialize(serialized);
  expect(typeof serialized === 'object').toEqual(true);
  expect(typeof serialized.a === 'function').toEqual(true);
  expect(serialized.a.name).toEqual('f');
});

test('(5 pts) serialize and deserialize complex cyclic structure', () => {
  const f = function f() {};
  let original = {a: f, b: f};
  original = [original, f, [original, f]];
  let serialized = util.serialize(original);
  serialized = util.deserialize(serialized);
  expect(Array.isArray(serialized)).toEqual(true);
  expect(typeof serialized[0] === 'object').toEqual(true);
  expect(typeof serialized[1] === 'function').toEqual(true);
  expect(serialized[1].name).toEqual('f');
  expect(Array.isArray(serialized[2])).toEqual(true);
});

test('(5 pts) serialize and deserialize array with references', () => {
  const x = {a: 1};
  const y = {z: x};
  const original = [x, y];
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(original);
});

test('(5 pts) serialize and deserialize array with references deep', () => {
  const x = {a: 1};
  const y = {z: x};
  const z = {y: y};
  const w = {z: z};
  const original = {x, y, z, w};
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(original);
});

test('(0 pts) serialize and deserialize preserves cyclic references', () => {
  const original = {};
  original.self = original;
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized.self).toBe(deserialized);
});

test('(0 pts) deserializeReference follows nested paths', () => {
  const original = {a: {}};
  original.a.self = original.a;
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized.a.self).toBe(deserialized.a);
});

test('(0 pts) serialize native function uses native mapping', () => {
  const nativeFn = require('path').join;
  const serialized = util.serialize(nativeFn);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toBe(nativeFn);
});

test('(0 pts) serializeBigInt', () => {
  const value = BigInt('9007199254740993');
  const serialized = util.serialize(value);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(value);
});

test('(0 pts) serializeBigIntHex', () => {
  const value = BigInt('0x1fffffffffffff');
  const serialized = util.serialize(value);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(value);
});

test('(0 pts) serializeBigIntInObject', () => {
  const object = {a: BigInt('123456789012345678')};
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(object);
});
