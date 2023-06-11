const CSVDatabase = require('./database');

const db = new CSVDatabase('./sample.csv');

// const query = `SELECT SUM("What is your current yearly salary?") FROM table_name WHERE "What country do you reside in?" = 'Brazil'`
const query = `SELECT department AS dep_name, COUNT(id) AS total_employees, MIN(salary) AS min_salary, salary + extra_comp AS total_comp FROM employees GROUP BY department ORDER BY total_employees`

const runQuery = async () => {
    console.log('Running query...');
    const data = await db.query(query);
    // console.dir({ data }, { depth: null });
}

runQuery();

