# csv-sql

`csv-sql` is a simple library that allows you to run SQL queries on CSV files.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Supported SQL Syntax](#supported-sql-syntax)
- [Examples](#examples)
- [Benchmark Results](#benchmark-results)


## Installation

You can install `csv-sql` using npm: `npm install csv-sql`


## Usage

To use `csv-sql`, you first need to create a new instance of the `CsvSql` class:

```javascript
const CsvSql = require('csv-sql');

const csvSql = new CsvSql('path/to/csv/file.csv');
```

You can also pass url to a CSV file:

```javascript
const csvSql = new CsvSql('https://example.com/file.csv');
```


You can then run SQL queries on the CSV data using the query method:
```javascript
const result = await csvSql.query('SELECT * FROM file WHERE column1 = "value"');
```

- The table name in the query must match the name of the CSV file.

- The column names in the query must match the column names in the CSV file.

- The values in the query must be enclosed in double quotes.

- The query must end with a semicolon.

- The result will be an array of objects, where each object represents a row in the CSV file.

## Supported SQL Syntax

`csv-sql` supports a subset of the SQL syntax. The following SQL statements are supported:

- `SELECT`
- `FROM`
- `WHERE`
- `AND`
- `OR`
- `ORDER BY`
- `GROUP BY`
- `HAVING`
- `LIMIT`
- `OFFSET`



The following operators are supported:

- `=`
- `!=`
- `>`
- `<`
- `>=`
- `<=`

The following functions are supported:

- `COUNT`
- `MIN`
- `MAX`
- `AVG`
- `SUM`
- `DISTINCT` 

## Examples

```javascript
const result = csvSql.query('SELECT * FROM data');
```

```javascript
const result = csvSql.query('SELECT column1, column2 FROM data');
```

# Benchmark Results


### Query 1: SELECT * FROM data

| Rows    | Time (ms) |
| ------- | --------- |
| 1000    | 19.9      |
| 10000   | 54.7      |
| 100000  | 63.5376   |
| 1000000 | 4528.325  |

### Query 2: SELECT * FROM data WHERE column1 = "value"

| Rows    | Time (ms) |
| ------- | --------- |
| 1000    | 8.53      |
| 10000   | 43.8      |
| 100000  | 52.5      |
| 1000000 | 2330.46   |













