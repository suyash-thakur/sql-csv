const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const CSVDatabase = require('../lib');

const csvFilePath = path.join(__dirname, 'largeData.csv');
const csvData = fs.readFileSync(csvFilePath, 'utf-8');

const rows = csvData.split('\n').map((row) => row.split(','));
const csvDatabase = new CSVDatabase([csvFilePath]);

const testQueries = [
  'SELECT * FROM largeData',
  'SELECT column1, column2 FROM largeData WHERE column1 = 10',
  'SELECT MAX(column1) AS total FROM largeData',
  'SELECT column1, column2 FROM largeData WHERE column3 = "value" AND column4 >= 100 ORDER BY column1 DESC LIMIT 10',
  'SELECT column1, column2 FROM largeData WHERE column3 = "value" AND column4 >= 100 GROUP BY column1, column2 ORDER BY column1 DESC LIMIT 10',
  // Add more test queries here...
];

const benchmark = async () => {
  for (const query of testQueries) {
    const start = performance.now();

    const result = await evaluateQuery(query, rows);

    const end = performance.now();
    const duration = end - start;

    console.log(`Query: ${query}`);
    console.log(`Result Length: ${JSON.stringify(result.length)}`);
    console.log(`Duration: ${duration} ms`);
  };
};
async function evaluateQuery(query, rows) {
  // Implement query evaluation logic here
  const result = await csvDatabase.query(query);
  return result;
}

benchmark();