const CSVDatabase = require('./database');

const db = new CSVDatabase('./sample.csv');

// const query = `SELECT SUM("What is your current yearly salary?") FROM table_name WHERE "What country do you reside in?" = 'Brazil'`
const query = `SELECT department, COUNT(*) AS total_employees FROM employees GROUP BY department ORDER BY total_employees DESC`

const runQuery = async () => {
    console.log('Running query...');
    const data = await db.query(query);
    console.log(data);
}

runQuery();

