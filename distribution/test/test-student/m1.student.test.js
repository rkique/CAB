/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/
const { performance } = require('perf_hooks');
const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const util = distribution.util;
//disable console.log here
console.log = () => {};
test('(1 pts) student test', () => {
  let object = "klfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfaldklfasjdlkfjalsdkjfFJKDDsdsfald"
  const start = performance.now()
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  const end = performance.now();
  console.log(`[String S/DS] took ${end - start} milliseconds.`);
  expect(deserialized).toEqual(object);

});

test('(1 pts) student test', () => {
  let func = function() { return 42; };
  const start = performance.now();
  const serialized = util.serialize(func);
  const deserialized = util.deserialize(serialized);
  const end = performance.now();
  console.log(`[Function S/DS] took ${end - start} milliseconds.`);
  expect(typeof deserialized).toBe('function');

});

test('(1 pts) student test', () => {
  let object = {a: {b: {c: 3}}}
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(object);
});

test('(1 pts) student test', () => {
  let object = new Date("2024-01-01T00:00:00Z")
  const start = performance.now();
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  const end = performance.now();
  console.log(`[Date S/DS] took ${end - start} milliseconds.`);
  expect(deserialized).toEqual(object);
});

test('(1 pts) student test', () => {
//test error
  let object = new Error("Test error message")
  const start = performance.now();
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  const end = performance.now();
  console.log(`[Error S/DS] took ${end - start} milliseconds.`);
  expect(deserialized.message).toEqual(object.message);
});
