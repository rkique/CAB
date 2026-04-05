/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const util = distribution.util;

test('(1 pts) student test', () => {
  // Fill out this test case...

  const values = [-3,-17.5, 'hello', '', true, false, null, undefined];

  for(const v of values){
    const s = util.serialize(v);
    const o = util.deserialize(s);
  

    expect(o).toBe(v);
}
});


test('(1 pts) student test', () => {
  // Fill out this test case...
  const f = (a,b) => a + b + 1;

  const s = util.serialize(f);
  const g = util.deserialize(s);

  expect(typeof g).toBe('function');
  expect(g(2,3)).toBe(6);
});


test('(1 pts) student test', () => {
  // Fill out this test case...
  const obj = {
    title: 'cs1380',
    nums: [1,2,3],
    mixed: [{a: 1}, {b: 'two'}, {c:false}],
    nothing: null,
    missing: undefined,
  };

  const s = util.serialize(obj);
  const o = util.deserialize(s);

  expect(o).toEqual(obj);
});

test('(1 pts) student test', () => {
  // Fill out this test case...
  const d = new Date('2025-02-03T03:04:05.006Z')
  
  const s = util.serialize(d);
  const d2 = util.deserialize(s);

  expect(d2).toBeInstanceOf(Date);
  expect(d2.getTime()).toBe(d.getTime());
});

test('(1 pts) student test', () => {
  // Fill out this test case...
  const e = new Error('missing');
  e.name = 'CustomErrorName';

  const s = util.serialize(e);
  const e2 = util.deserialize(s);

  expect(e2).toBeInstanceOf(Error);
  expect(e2.message).toBe('missing');
  
});
