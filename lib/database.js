const fs = require('fs');
const csv = require('csv-parser');

class CSVDatabase {
  constructor(csvFilePath) {
    this.data = [];
    this.isLoaded = false;
    this.loadCSVPromise = this.loadCSV(csvFilePath);
  }

  loadCSV(csvFilePath) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          this.data.push(row);
        })
        .on('end', () => {
          this.isLoaded = true;
          console.log('CSV file successfully processed');
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async query(sql) {
    if (!this.isLoaded) {
      await this.loadCSVPromise;
    }
    const tokens = this.tokenize(sql);
    const ast = this.parse(tokens);
    // const result = this.evaluate(ast, this.data);
    return ast;
  }

tokenize(sql) {
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'SUM', 'COUNT', 'GROUP BY', 'ORDER BY'];
  const operators = ['=', '!=', '<', '>', '<=', '>='];
  const separators = ['(', ')', ','];

  const tokens = [];
  let currentToken = '';

  function addToken(type, value) {
    tokens.push({ type, value });
    currentToken = '';
  }

  let i = 0;
  while (i < sql.length) {
    const char = sql[i];

    if (char === ' ') {
      if (currentToken !== '') {
        if (keywords.includes(currentToken.toUpperCase())) {
          addToken('keyword', currentToken.toUpperCase());
        } else {
          addToken('identifier', currentToken);
        }
      }
      i++;
    } else if (separators.includes(char)) {
      if (currentToken !== '') {
        if (keywords.includes(currentToken.toUpperCase())) {
          addToken('keyword', currentToken.toUpperCase());
        } else {
          addToken('identifier', currentToken);
        }
      }
      addToken('separator', char);
      i++;
    } else if (char === '*') {
      if (currentToken !== '') {
        if (keywords.includes(currentToken.toUpperCase())) {
          addToken('keyword', currentToken.toUpperCase());
        } else {
          addToken('identifier', currentToken);
        }
      }
      addToken('identifier', char);
      i++;
    } else if (char === '"') {
      const startIndex = i;
      const endIndex = sql.indexOf('"', startIndex + 1);
      if (endIndex === -1) {
        throw new Error('Invalid SQL query: Unterminated string literal');
      }
      const value = sql.slice(startIndex + 1, endIndex);
      addToken('identifier', value);
      i = endIndex + 1;
    } else if (char === "'") {
      const startIndex = i;
      const endIndex = sql.indexOf("'", startIndex + 1);
      if (endIndex === -1) {
        throw new Error('Invalid SQL query: Unterminated string literal');
      }
      const value = sql.slice(startIndex + 1, endIndex);
      addToken('string', value);
      i = endIndex + 1;
    } else if (operators.includes(char)) {
      if (currentToken !== '') {
        if (keywords.includes(currentToken.toUpperCase())) {
          addToken('keyword', currentToken.toUpperCase());
        } else {
          addToken('identifier', currentToken);
        }
      }
      addToken('operator', char);
      i++;
    } else if (/[a-zA-Z_]/.test(char)) {
      currentToken += char;
      i++;
    } else {
      throw new Error(`Invalid character: ${char}`);
    }
  }

  if (currentToken !== '') {
    if (keywords.includes(currentToken.toUpperCase())) {
      addToken('keyword', currentToken.toUpperCase());
    } else {
      addToken('identifier', currentToken);
    }
  }

  return tokens;
}




parse(tokens) {
  let currentTokenIndex = 0;

  function parseSelect() {
    match('SELECT');
    const expression = parseExpression();
    const groupBy = parseGroupBy();
    const orderBy = parseOrderBy();
    return { type: 'SELECT', expression, groupBy, orderBy };
  }

  function parseExpression() {
    const token = tokens[currentTokenIndex];

    if (token.type === 'keyword') {
      if (token.value === 'SUM' || token.value === 'COUNT') {
        match(token.value);
        match('(');

        let columnName;
        if (tokens[currentTokenIndex].type === 'identifier' && tokens[currentTokenIndex].value === '*') {
          columnName = '*';
          match('*');
        } else {
          columnName = matchIdentifier();
        }

        match(')');
        return { type: 'AGGREGATE', function: token.value, columnName };
      } else {
        throw new Error('Unsupported keyword: ' + token.value);
      }
    } else if (token.type === 'identifier') {
      const columnName = matchIdentifier();
      const alias = parseAlias(); // Check for alias using AS
      return { type: 'COLUMN', columnName, alias };
    } else {
      throw new Error('Unexpected token: ' + token.value);
    }
  }
  function parseAlias() {
    console.log(tokens, currentTokenIndex);
    console.log('parseAlias', tokens[currentTokenIndex]);
    if (tokens[currentTokenIndex] && tokens[currentTokenIndex].value === 'AS') {
      match('AS');
      return matchIdentifier();
    }
    return null;
  }
  function parseGroupBy() {
    if (tokens[currentTokenIndex] && tokens[currentTokenIndex].value === 'GROUP BY') {
      match('GROUP BY');
      const columnNames = parseColumnNames();
      return { type: 'GROUP BY', columnNames };
    }
    return null;
  }

  function parseOrderBy() {
    if (tokens[currentTokenIndex] && tokens[currentTokenIndex].value === 'ORDER BY') {
      match('ORDER BY');
      const columnNames = parseColumnNames();
      return { type: 'ORDER BY', columnNames };
    }
    return null;
  }

  function parseColumnNames() {
    const columnNames = [];
    columnNames.push(matchIdentifier());
    while (tokens[currentTokenIndex] && tokens[currentTokenIndex].value === ',') {
      match(',');
      columnNames.push(matchIdentifier());
    }
    return columnNames;
  }

  function match(expectedToken) {
    const token = tokens[currentTokenIndex];

    if (token.value === expectedToken) {
      currentTokenIndex++;
    } else {
      throw new Error('Expected token: ' + expectedToken);
    }
  }

  function matchIdentifier() {
    const token = tokens[currentTokenIndex];
    if (token.type === 'identifier') {
      currentTokenIndex++;
      return token.value;
    } else {
      throw new Error('Expected identifier but found: ' + token.value);
    }
  }

  // Use a loop instead of recursion
  let ast = parseSelect();
  while (currentTokenIndex < tokens.length) {
    const token = tokens[currentTokenIndex];

    if (token.value === ',') {
      currentTokenIndex++;
      const expression = parseExpression();
      ast.expression = { type: 'COMPOUND', expressions: [ast.expression, expression] };
    } else {
      throw new Error('Unexpected token: ' + token.value);
    }
  }

  return ast;
}


  
  evaluate(ast, data) {
    if (ast.type === 'SELECT') {
      return evaluateExpression(ast.expression, data);
    }
    return null;
  }
  

  evaluateExpression(expression, data) {
    if (expression.type === 'AGGREGATE') {
      const { function: aggregateFunction, columnName } = expression;
      const filteredData = filterData(data, expression.filter);
      return calculateAggregate(filteredData, aggregateFunction, columnName);
    } else if (expression.type === 'COLUMN') {
      // Evaluate column expression
      return evaluateColumn(expression.columnName, data);
    }
    return null;
  }
  
  filterData(data, filter) {
    const [column, operator, value] = filter;
  
    return data.filter(row => {
      switch (operator) {
        case '=':
          return row[column] === value;
        case '!=':
          return row[column] !== value;
        case '<':
          return row[column] < value;
        case '>':
          return row[column] > value;
        case '<=':
          return row[column] <= value;
        case '>=':
          return row[column] >= value;
        default:
          return true;
      }
    }); 
  }
  
  calculateAggregate(data, aggregateFunction, columnName) {
    // Implement the logic to calculate the aggregate value
  }
  
  evaluateColumn(columnName, data) {
    // Implement the logic to evaluate the column expression
  }
}
module.exports = CSVDatabase;