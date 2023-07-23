const tap = require('tap');
const CSVDatabase = require('../lib/index');
const fs = require('fs');
const path = require('path');

const csvFilePath = path.join(__dirname, 'data.csv');

tap.test('CSVDatabase', async (t) => {
    // Create a temporary CSV file for testing
    const testData = [
        { name: 'John', age: 25 },
        { name: 'Jane', age: 30 },
        { name: 'Bob', age: 35 },
    ];
    await createTestCSV(csvFilePath, testData);

    t.test('query - Executes SQL query', async (t) => {
        const database = new CSVDatabase([csvFilePath]);

        const sql = 'SELECT * FROM data WHERE age > 25';
        const result = await database.query(sql);
        console.log(result);
        t.equal(result.length, 2, 'Query result contains correct number of rows');
        t.equal(result[0].name[0], 'Jane', 'Query result contains correct data');
        t.equal(result[1].name[0], 'Bob', 'Query result contains correct data');
    });

    // Add more tests as needed

    t.test('query - Executes SQL query', async (t) => {
        const database = new CSVDatabase([csvFilePath]);

        const sql = 'SELECT SUM(age) as total_age FROM data';
        const result = await database.query(sql);
        console.log(result);
        t.equal(result.length, 1, 'Query result contains correct number of rows');
        t.equal(result[0].total_age[0], '90', 'Query result contains correct data');
    });

    // Clean up the temporary CSV file after all tests have finished
    t.teardown(() => {
        fs.unlinkSync(csvFilePath);
    });
});

// Helper function to create a test CSV file
function createTestCSV(filePath, data) {
    return new Promise((resolve, reject) => {
        const columnNames = Object.keys(data[0]);
        const csvData = [columnNames.join(',')];
        data.forEach((row) => {
            const values = columnNames.map((columnName) => row[columnName]);
            csvData.push(values.join(','));
        });
        fs.writeFile(filePath, csvData.join('\n'), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
