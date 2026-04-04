const fs = require('fs');

require('../../distribution.js')();
const log = require('../../distribution/util/log.js');

const distribution = globalThis.distribution;
const id = distribution.util.id;

const ncdcGroup = {};
const dlibGroup = {};
const tfidfGroup = {};
const crawlGroup = {};
const urlxtrGroup = {};
const strmatchGroup = {};
const ridxGroup = {};
const rlgGroup = {};


/*
    The local node will be the orchestrator.
*/

const n1 = { ip: '127.0.0.1', port: 7110 };
const n2 = { ip: '127.0.0.1', port: 7111 };
const n3 = { ip: '127.0.0.1', port: 7112 };

test('(0 pts) (scenario) all.mr:ncdc', (done) => {
/* Implement the map and reduce functions.
   The map function should parse the string value and return an object with the year as the key and the temperature as the value.
   The reduce function should return the maximum temperature for each year.

   (The implementation for this scenario is provided below.)
*/
  //data of the form '004301199099999 1950 0515070049999999N9 +0000 1+9999'
  //is effectively:
  // (1950, 0), (1950, 22), (1950, -11)
  // (1949, 111), (1949, 78)

  //data[1] is the year, data[3] is the temperature
  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const out = {};
    out[words[1]] = parseInt(words[3]);
    return out;
  };
  //test expected minimum temperature across two years
  const reducerMin = (key, values) => {
    const out = {};
    out[key] = values.reduce((a, b) => Math.min(a,b), Infinity);
    return out
  }
  //for each key, values are provided to be reduced.
  const reducer = (key, values) => {
    console.log('mapper output for key', key, 'values', values);
    console.log('')
    const out = {};
    out[key] = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return out;
  };

  const dataset = [
    {'000': '006701199099999 1950 0515070049999999N9 +0000 1+9999'},
    {'106': '004301199099999 1950 0515120049999999N9 +0022 1+9999'},
    {'212': '004301199099999 1950 0515180049999999N9 -0011 1+9999'},
    {'318': '004301265099999 1949 0324120040500001N9 +0111 1+9999'},
    {'424': '004301265099999 1949 0324180040500001N9 +0078 1+9999'},
  ];

  const expected = [{'1950': 22}, {'1949': 111}];
  const expectedMin = [{'1950': -11}, {'1949': 78}]

  const doMapReduce = () => {
    distribution.ncdc.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }


      distribution.ncdc.mr.exec({keys: v, map: mapper, reduce: reducerMin}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expectedMin));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.ncdc.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:dlib', (done) => {
/*
   Implement the map and reduce functions.
   The map function should parse the string value and return an object with the word as the key and the value as 1.
   The reduce function should return the count of each word.
*/

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const out = [];
    for (const word of words){
      out.push({[word]: 1});
    }
    return out;
  };
  //values are given in reduceable form
  // e.g. {epoch, 1}, {epoch, 1}
  const reducer = (key, values) => {
    const out = {}
    //use reduce with initial value of 0
    out[key] = values.reduce((sum, v) => sum + v, 0);
    return out;
  };

  const dataset = [
    {'b1-l1': 'It was the best of times, it was the worst of times,'},
    {'b1-l2': 'it was the age of wisdom, it was the age of foolishness,'},
    {'b1-l3': 'it was the epoch of belief, it was the epoch of incredulity,'},
    {'b1-l4': 'it was the season of Light, it was the season of Darkness,'},
    {'b1-l5': 'it was the spring of hope, it was the winter of despair,'},
  ];

  const expected = [
    {It: 1}, {was: 10},
    {the: 10}, {best: 1},
    {of: 10}, {'times,': 2},
    {it: 9}, {worst: 1},
    {age: 2}, {'wisdom,': 1},
    {'foolishness,': 1}, {epoch: 2},
    {'belief,': 1}, {'incredulity,': 1},
    {season: 2}, {'Light,': 1},
    {'Darkness,': 1}, {spring: 1},
    {'hope,': 1}, {winter: 1},
    {'despair,': 1},
  ];

  const doMapReduce = () => {
    distribution.dlib.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.dlib.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.dlib.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:tfidf', (done) => {
/*
    Implement the map and reduce functions.
    The map function should parse the string value 
    and return an object with the word as the key and the document and count as the value.
    The reduce function should return the TF-IDF for each word.

    Hint:
    TF = (Number of times the term appears in a document) / (Total number of terms in the document)
    IDF = log10(Total number of documents / Number of documents with the term in it)
    TF-IDF = TF * IDF
*/

  const mapper = (key, value) => {
    //word to doc-count.
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const counts = {};
    //count terms within the document
    for (const word of words){
      counts[word] = (counts[word] || 0) + 1;
    }
    //Emit one record per unique word
    // {word: [countInDoc, docId, docLength] }
    const out = [];
    for (const [word, count] of Object.entries(counts)) {
      //allows use of string as key
      out.push({ [word]: [count, key, words.length] });
    }
    return out;
  };

// Reduce function: calculate TF-IDF for each word
//format: key is 'epoch', value is {[(2, doc1), (3, doc2)]}
const reducer = (key, values) => {
  const totalDocs = 3;

  const tuples = Array.isArray(values[0])
    ? values
    : values.reduce((acc, _, i, arr) => {
        if (i % 3 === 0) acc.push([arr[i], arr[i + 1], arr[i + 2]]);
        return acc;
      }, []);
  const idf = Math.log10(totalDocs / tuples.length);
  const perDoc = {};
  // {doc1: tfidf1, doc2: tfidf2}
  for (const [count, docId, docLen] of tuples) {
    const tfidf = (count / docLen) * idf;
    perDoc[docId] = Number(tfidf.toFixed(2));
  }
  return {[key]: perDoc};
};

  const dataset = [
    {'doc1': 'machine learning is amazing'},
    {'doc2': 'deep learning powers amazing systems'},
    {'doc3': 'machine learning and deep learning are related'},
  ];

  const expected = [{'is': {'doc1': 0.12}},
    {'deep': {'doc2': 0.04, 'doc3': 0.03}},
    {'systems': {'doc2': 0.1}},
    {'learning': {'doc1': 0, 'doc2': 0, 'doc3': 0}},
    {'amazing': {'doc1': 0.04, 'doc2': 0.04}},
    {'machine': {'doc1': 0.04, 'doc3': 0.03}},
    {'are': {'doc3': 0.07}}, {'powers': {'doc2': 0.1}},
    {'and': {'doc3': 0.07}}, {'related': {'doc3': 0.07}}];

  const doMapReduce = () => {
    distribution.tfidf.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.tfidf.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // Send the dataset to the cluster
  dataset.forEach((o) => {
    //access string key value within singleton array Object.keys
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.tfidf.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

// /*
//   The rest of the scenarios are left as an exercise.
//   For each one you'd like to implement, you'll need to:
//   - Define the map and reduce functions.
//   - Create a dataset.
//   - Run the map reduce.
// */

// test('(10 pts) (scenario) all.mr:crawl', (done) => {
//     done(new Error('Implement this test.'));
// });

// test('(10 pts) (scenario) all.mr:urlxtr', (done) => {

//     const reducer = (key, values) => {}
//     const docs = []
//     const expected = []
//     //we would like to extract urls from page identifier on disk
//     //extract via map
//     const mapper = (key, value) => {}
//     //check for duplicates & store via reduce.

//     done(new Error('Implement the map and reduce functions'));
// });

test('(10 pts) (scenario) all.mr:strmatch', (done) => {
   // identify all the object IDs that match that regular expression in the dataset. 
   // String matching is achieved by map, and all results are accumulated via reduce.
   //if regex matches, output key
  const mapper = (key, value) => {
        if (/dog/.test(value)) {
          return {[key]: value}; 
        }
        return {[key]: null};
    };

    const reducer = (key, values) => {
      if (values.some((v) => v !== null)) {
        return [key];
      }
      return [];
    };

  const docs = [
    { 'doc1': 'the cat' },
    { 'doc2': 'the dog and cat' },
    { 'doc3': 'the cat and mouse' }
  ]

  const expected = ['doc2']

  const doMapReduce = () => {
  distribution.strmatch.store.get(null, (e, v) => {
        try {
          expect(v.length).toEqual(docs.length);
        } catch (e) {
          done(e);
        }

        distribution.strmatch.mr.exec({ keys: v, map: mapper, reduce: reducer }, (e, v) => {
          try {
            expect(v).toEqual(expect.arrayContaining(expected));
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    };
    
    let cntr = 0;
    //send the dataset to the cluster
    docs.forEach((o) => {
      const key = Object.keys(o)[0];
      const value = o[key];
      distribution.strmatch.store.put(value, key, (e, v) => {
        cntr++;
        //once dataset is in place, run the map reduce
        if (cntr === docs.length) {
          doMapReduce();
        }
      });
    });
  });

test('(10 pts) (scenario) all.mr:ridx', (done) => {
  //dataset is 
  const docs = [
    { 'doc1': 'the cat' },
    { 'doc2': 'the dog and cat' },
    { 'doc3': 'the cat and mouse' }
  ]

  const expected = [{"mouse": ["doc3"]}, {"dog": ["doc2"]}, 
                    {"and": ["doc2", "doc3"]}, 
                    {"the": ["doc2", "doc1", "doc3"]},
                    {"cat": ["doc2", "doc1", "doc3"]}]

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const out = [];
    for (const word of words) {
      out.push({ [word]: key })
    }
    return out;
  };
  
  const reducer = (key, values) => {
    const out = {}
    out[key] = values.reduce((arr, doc) => { arr.push(doc); return arr; }, []);
    return out
  };

  const doMapReduce = () => {
    distribution.ridx.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(docs.length);
      } catch (e) {
        done(e);
      }
      distribution.ridx.mr.exec({ keys: v, map: mapper, reduce: reducer }, (e, v) => {
        try {
          const getWord = (obj) => Object.keys(obj)[0];
          const sortObj = (obj) => {
            const word = getWord(obj);
            return { [word]: obj[word].sort() };
          }
          const sorted = v.map(sortObj);
          const sortedExpected = expected.map(sortObj);

          expect(sorted).toEqual(expect.arrayContaining(sortedExpected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  docs.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.ridx.store.put(value, key, (e, v) => {
      cntr++;
      if (cntr === docs.length) {
        doMapReduce();
      }
    });
  });
});

// test('(10 pts) (scenario) all.mr:rlg', (done) => {
//     done(new Error('Implement the map and reduce functions'));
// });

/*
    This is the setup for the test scenario.
    Do not modify the code below.
*/

beforeAll((done) => {
  ncdcGroup[id.getSID(n1)] = n1;
  ncdcGroup[id.getSID(n2)] = n2;
  ncdcGroup[id.getSID(n3)] = n3;

  dlibGroup[id.getSID(n1)] = n1;
  dlibGroup[id.getSID(n2)] = n2;
  dlibGroup[id.getSID(n3)] = n3;

  tfidfGroup[id.getSID(n1)] = n1;
  tfidfGroup[id.getSID(n2)] = n2;
  tfidfGroup[id.getSID(n3)] = n3;

  crawlGroup[id.getSID(n1)] = n1;
  crawlGroup[id.getSID(n2)] = n2;
  crawlGroup[id.getSID(n3)] = n3;

  urlxtrGroup[id.getSID(n1)] = n1;
  urlxtrGroup[id.getSID(n2)] = n2;
  urlxtrGroup[id.getSID(n3)] = n3;

  strmatchGroup[id.getSID(n1)] = n1;
  strmatchGroup[id.getSID(n2)] = n2;
  strmatchGroup[id.getSID(n3)] = n3;

  ridxGroup[id.getSID(n1)] = n1;
  ridxGroup[id.getSID(n2)] = n2;
  ridxGroup[id.getSID(n3)] = n3;

  rlgGroup[id.getSID(n1)] = n1;
  rlgGroup[id.getSID(n2)] = n2;
  rlgGroup[id.getSID(n3)] = n3;


  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, (e, v) => {
          cb();
        });
      });
    });
  };

  distribution.node.start(() => {
    const ncdcConfig = { gid: 'ncdc' };
    startNodes(() => {
      distribution.local.groups.put(ncdcConfig, ncdcGroup, (e, v) => {
        distribution.ncdc.groups.put(ncdcConfig, ncdcGroup, (e, v) => {
          const dlibConfig = { gid: 'dlib' };
          distribution.local.groups.put(dlibConfig, dlibGroup, (e, v) => {
            distribution.dlib.groups.put(dlibConfig, dlibGroup, (e, v) => {
              const tfidfConfig = { gid: 'tfidf' };
              distribution.local.groups.put(tfidfConfig, tfidfGroup, (e, v) => {
                distribution.tfidf.groups.put(tfidfConfig, tfidfGroup, (e, v) => {
                  //put ridx group
                  const ridxConfig = { gid: 'ridx' };
                  distribution.local.groups.put(ridxConfig, ridxGroup, (e, v) => {
                    distribution.ridx.groups.put(ridxConfig, ridxGroup, (e, v) => {
                      //pu strmatch group
                      const strmatchConfig = { gid: 'strmatch' };
                      distribution.local.groups.put(strmatchConfig, strmatchGroup, (e, v) => {
                        distribution.strmatch.groups.put(strmatchConfig, strmatchGroup, (e, v) => {
                        done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

afterAll((done) => {
  const remote = { service: 'status', method: 'stop' };
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});

