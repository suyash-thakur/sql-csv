const CSVDatabase = require('./database');

const db = new CSVDatabase('https://suyashwebtest.s3.ap-south-1.amazonaws.com/sample.csv');

// const query = `SELECT SUM("What is your current yearly salary?") AS tot_sal, "What country do you reside in?" FROM table_name WHERE "Do you enjoy the work you do? " = 'Yes' GROUP BY "What country do you reside in?" ORDER BY "tot_sal" DESC`
const query = `SELECT "What is your current yearly salary?" AS tot_sal, "What country do you reside in?" FROM table_name WHERE "Do you enjoy the work you do? " = 'Yes' ORDER BY "tot_sal" DESC`

// const query = `SELECT SUM("What is your current yearly salary?") AS tot_sal, "What is your current yearly salary?" + 100 AS SAL_2 FROM table_name WHERE "What country do you reside in?" = 'Brazil' AND "Do you enjoy the work you do?" = 'Yes'`
// const query = `SELECT department AS dep_name, COUNT(id) AS total_employees, MIN(salary) AS min_salary, salary + extra_comp AS total_comp FROM employees GROUP BY department HAVING  total_comp > 100000 ORDER BY total_comp DESC`

const runQuery = async () => {
    console.log('Running query...');
    console.log(query);
    const data1 = await db.query(query);
    // console.dir({ data }, { depth: null });
}

runQuery();

