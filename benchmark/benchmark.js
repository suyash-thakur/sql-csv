const Benchmark = require('benchmark');
const CSVDatabase = require('../lib/index');

const suite = new Benchmark.Suite();

const csvFilePath = `${__dirname}/largeData.csv`;


const testQueries = [
  // 'SELECT * FROM largeData',
  // 'SELECT column1, column2 FROM largeData WHERE column1 = 10',
  'SELECT MAX(column1) AS total FROM largeData',
  // 'SELECT column1, column2 FROM largeData WHERE column3 = "value" AND column4 >= 100 ORDER BY column1 DESC LIMIT 10',
  // Add more test queries here...
];




const csvFilePaths = [csvFilePath]; // Replace with the path to your generated CSV file

const csvDatabase = new CSVDatabase(csvFilePaths);

testQueries.forEach((query) => {
  suite.add(query, async () => {
    await csvDatabase.query(query);
  });
});

suite
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .on('complete', () => {
    console.log('Benchmark completed.');
  })
  .run({ async: true });

