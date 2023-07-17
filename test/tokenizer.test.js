const tap = require('tap');
const Tokenizer = require('../lib/tokenizer');

tap.test('Tokenizer', (t) => {
    t.test('tokenize - Tokenizes simple SQL query correctly', (t) => {
        const sql = 'SELECT column1, column2 FROM table';
        const tokenizer = new Tokenizer(sql);
        const tokens = tokenizer.tokens;
        t.equal(tokens.length, 6, 'Correct number of tokens');
        t.equal(tokens[0].type, 'keyword', 'First token is a keyword');
        t.equal(tokens[0].value, 'SELECT', 'First token has correct value');
        t.equal(tokens[1].type, 'identifier', 'Second token is an identifier');
        t.equal(tokens[1].value, 'column1', 'Second token has correct value');
        t.equal(tokens[2].type, 'separator', 'Third token is a separator');
        t.equal(tokens[2].value, ',', 'Third token has correct value');
        t.equal(tokens[3].type, 'identifier', 'Fourth token is an identifier');
        t.equal(tokens[3].value, 'column2', 'Fourth token has correct value');
        t.equal(tokens[4].type, 'keyword', 'Fifth token is a keyword');
        t.equal(tokens[4].value, 'FROM', 'Fifth token has correct value');
        t.equal(tokens[5].type, 'identifier', 'Sixth token is an identifier');
        t.equal(tokens[5].value, 'table', 'Sixth token has correct value');

        t.end();
    });

    t.test('tokenize - Tokenizes SQL query with strings and numbers', (t) => {
        const sql = 'SELECT name, age FROM users WHERE age >= 18 AND country = "USA" AND income > 50000';
        const tokenizer = new Tokenizer(sql);
        const tokens = tokenizer.tokens;
        t.equal(tokens.length, 18, 'Correct number of tokens');
        t.equal(tokens[0].type, 'keyword', 'First token is a keyword');
        t.equal(tokens[0].value, 'SELECT', 'First token has correct value');
        t.equal(tokens[1].type, 'identifier', 'Second token is an identifier');
        t.equal(tokens[1].value, 'name', 'Second token has correct value');
        t.equal(tokens[2].type, 'separator', 'Third token is a separator');
        t.equal(tokens[2].value, ',', 'Third token has correct value');
        t.end();
    });

    t.test('tokenize - Tokenizes SQL query with operators and parentheses', (t) => {
        const sql = 'SELECT * FROM table WHERE (age >= 18 OR (country = "USA" AND income > 50000))';
        const tokenizer = new Tokenizer(sql);
        const tokens = tokenizer.tokens;

        t.equal(tokens.length, 20, 'Correct number of tokens');
        t.equal(tokens[0].type, 'keyword', 'First token is a keyword');
        t.equal(tokens[0].value, 'SELECT', 'First token has correct value');
        t.equal(tokens[1].type, 'identifier', 'Second token is an identifier');
        t.equal(tokens[1].value, '*', 'Second token has correct value');
        t.equal(tokens[2].type, 'keyword', 'Third token is a keyword');
        t.equal(tokens[2].value, 'FROM', 'Third token has correct value');
        t.end();
    });

    t.test('tokenize - Throws error for invalid SQL query', (t) => {
        const sql = 'SELECT * FROM table WHERE column = "John';
        t.throws(() => {
            new Tokenizer(sql);
        }, 'Throws error for unterminated string literal');

        t.end();
    });

    t.end();
});
