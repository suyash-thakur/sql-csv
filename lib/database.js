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
    const fromTokenIndex = tokens.findIndex(token => token.value === 'FROM');
    const select = this.selectAst(tokens.slice(0, fromTokenIndex));
    console.dir({ select }, { depth: null });

    // const ast = this.parse(tokens);

    // const result = this.evaluate(ast, this.data);
    return tokens;
  }



  tokenize(sql) {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'SUM', 'COUNT', 'GROUP', 'ORDER', 'BY', 'AS', 'AVG', 'MIN', 'MAX', 'NOT', 'AND', 'OR', 'MAX', 'MIN', 'DISTINCT', 'ASC', 'DESC'];
    const operators = ['=', '!=', '<', '>', '<=', '>=', '*', '+', '-', '/'];
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

  selectAst(tokens) {
    const selectAst = [];
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
    if (currentToken.value !== 'SELECT') {
      throw new Error('Expected SELECT but found: ' + currentToken.value);
    }
    currentTokenIndex++;

    function getBetweenParenthesis() {
      const startIndex = currentTokenIndex;
      const endIndex = tokens.findIndex((token, index) => token.value === ')' && index > startIndex);
      if (endIndex === -1) {
        throw new Error('Invalid SQL query: Unterminated string literal');
      }
      const betweenParenthesis = tokens.slice(startIndex + 1, endIndex);
      currentTokenIndex = endIndex;
      return betweenParenthesis;
    }

    function handleAS() {
      const currentSelectObject = selectAst[selectAst.length - 1];
      currentTokenIndex++;
      currentToken = tokens[currentTokenIndex];
      if (currentToken.type === 'identifier') {
        currentSelectObject.alias = currentToken.value;
      } else {
        throw new Error('Expected identifier but found: ' + currentToken.value);
      }
    }

    function handleOperation(operationName) {
      const currentSelectObject = selectAst[selectAst.length - 1];
      currentTokenIndex++;
      currentToken = tokens[currentTokenIndex];
      if (currentToken.value === '(') {
        currentSelectObject.expression = {
          type: 'function',
          name: operationName,
          arguments: getBetweenParenthesis()
        };
      }
    }

    while (currentTokenIndex < tokens.length) {

      currentToken = tokens[currentTokenIndex];

      if (currentToken.type === 'separator') {
        currentTokenIndex++;
        continue;
      }

      const selectObject = {
        type: 'column',
      };

      if (currentToken.type === 'identifier') {
        selectObject.name = currentToken.value;
        selectAst.push(selectObject);

      }
  
      if (currentToken.type === 'keyword') {
        if (currentToken.value === 'AS') {
          handleAS();
        }
  
        if (['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'].includes(currentToken.value)) {
          selectAst.push(selectObject);
          handleOperation(currentToken.value);
        }
      }
  
      currentTokenIndex++;
    }
  
    return selectAst;
  }
}
module.exports = CSVDatabase;