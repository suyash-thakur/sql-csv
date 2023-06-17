const fs = require('fs');
const csv = require('csv-parser');
class CSVDatabase {
  constructor(csvFilePath) {
    this.data = [];
    this.isLoaded = false;
  }



  tokenize(sql) {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'SUM', 'COUNT', 'GROUP', 'ORDER', 'BY', 'AS', 'AVG', 'MIN', 'MAX', 'NOT', 'AND', 'OR', 'MAX', 'MIN', 'DISTINCT', 'ASC', 'DESC', 'HAVING'];
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
          } else if (!isNaN(Number(currentToken))) {
            addToken('number', currentToken);
          } else {
            addToken('identifier', currentToken);
          }
        }
        i++;
      } else if (separators.includes(char)) {
        if (currentToken !== '') {
          if (keywords.includes(currentToken.toUpperCase())) {
            addToken('keyword', currentToken.toUpperCase());
          } else if (!isNaN(Number(currentToken))) {
            addToken('number', currentToken);
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
          } else if (!isNaN(Number(currentToken))) {
            addToken('number', currentToken);
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
          } else if (!isNaN(Number(currentToken))) {
            addToken('number', currentToken);
          } else {
            addToken('identifier', currentToken);
          }
        }
        addToken('operator', char);
        i++;
      } else if (/[a-zA-Z_]/.test(char)) {
        currentToken += char;
        i++;
      } else if (/[0-9]/.test(char)) {
        currentToken += char;
        i++;
      } else {
        throw new Error(`Invalid character: ${char}`);
      }
    }
  
    if (currentToken !== '') {
      if (keywords.includes(currentToken.toUpperCase())) {
        addToken('keyword', currentToken.toUpperCase());
      } else if (!isNaN(Number(currentToken))) {
        addToken('number', currentToken);
      } else {
        addToken('identifier', currentToken);
      }
    }
  
    return tokens;
  }
  
   #selectAst(tokens) {
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

    function handleBinaryExpression() {
      const currentSelectObject = selectAst[selectAst.length - 1];
      const left = tokens[currentTokenIndex - 1];
      const operator = tokens[currentTokenIndex];
      const right = tokens[currentTokenIndex + 1];
      currentSelectObject.type = 'binary_expression';
      currentSelectObject.left = left;
      currentSelectObject.operator = operator;
      currentSelectObject.right = right;
      currentTokenIndex += 1;
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

      if (currentToken.type === 'operator') {
        handleBinaryExpression();
      }
  
      currentTokenIndex++;
    }
  
    return selectAst;
  }

  #fromAst(tokens) {
    const fromAst = [];
    if(tokens.length === 0) return fromAst;
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
    if (currentToken.value !== 'FROM') {
      throw new Error('Expected FROM but found: ' + currentToken.value);
    }
    currentTokenIndex++;
  
    while (currentTokenIndex < tokens.length) {
      currentToken = tokens[currentTokenIndex];
  
      if (currentToken.type === 'separator') {
        currentTokenIndex++;
        continue;
      }
  
      const fromObject = {};
  
      if (currentToken.type === 'identifier') {
        fromObject.type = 'table';
        fromObject.name = currentToken.value;
        fromAst.push(fromObject);
      }
  
      currentTokenIndex++;
    }
  
    return fromAst;
  }

  #whereAst(tokens) {
    console.log(tokens);
    const whereAst = [];
    if(tokens.length === 0) return whereAst;
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
    if (currentToken.value !== 'WHERE') {
      throw new Error('Expected WHERE but found: ' + currentToken.value);
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
  
    function handleBinaryExpression() {
      const currentWhereObject = whereAst[whereAst.length - 1];
      const left = tokens[currentTokenIndex - 1];
      const operator = tokens[currentTokenIndex];
      const right = tokens[currentTokenIndex + 1];
      const binaryExpression = {
        type: 'binary_expression',
        left: left,
        operator: operator,
        right: right
      };
      currentWhereObject.expression = binaryExpression;
      currentTokenIndex += 1;
    }
  
    while (currentTokenIndex < tokens.length) {
      currentToken = tokens[currentTokenIndex];
  
      if (currentToken.type === 'separator') {
        currentTokenIndex++;
        continue;
      }
  
      const whereObject = {};
  
      if (currentToken.type === 'keyword') {
        if (currentToken.value === 'AND' || currentToken.value === 'OR') {
          whereObject.type = 'logical_operator';
          whereObject.operator = currentToken.value;
          whereAst.push(whereObject);
        }
        
      }
  
      if (currentToken.type === 'identifier') {
        whereObject.type = 'column';
        whereObject.name = currentToken.value;
        whereAst.push(whereObject);
      }
  
      if (currentToken.type === 'operator') {
        handleBinaryExpression();
      }
  
      if (currentToken.type === 'literal') {
        whereObject.type = 'literal';
        whereObject.value = currentToken.value;
        whereAst.push(whereObject);
      }
  
      if (currentToken.value === '(') {
        const subqueryAst = getBetweenParenthesis();
        whereObject.type = 'subquery';
        whereObject.subqueryAst = subqueryAst;
        whereAst.push(whereObject);
      }
  
      currentTokenIndex++;
    }
  
    return whereAst;
  }

  #groupByAst(tokens) {
    const groupByAst = {
      columns: [],
      having: []
    };
  
    if (tokens.length === 0) return groupByAst;
  
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
  
    if (currentToken.value !== 'GROUP') {
      throw new Error('Expected GROUP but found: ' + currentToken.value);
    }
  
    currentTokenIndex++;
  
    while (currentTokenIndex < tokens.length) {
      currentToken = tokens[currentTokenIndex];
  
      if (currentToken.type === 'separator') {
        currentTokenIndex++;
        continue;
      }
  
      const groupByObject = {};
  
      if (currentToken.type === 'identifier') {
        groupByObject.type = 'column';
        groupByObject.name = currentToken.value;
        groupByAst.columns.push(groupByObject);
      }
  
      if (currentToken.value === 'HAVING') {
        currentTokenIndex++;
  
        while (currentTokenIndex < tokens.length) {
          currentToken = tokens[currentTokenIndex];
  
          if (currentToken.type === 'separator') {
            currentTokenIndex++;
            continue;
          }
  
          const havingObject = {};
  
          if (currentToken.type === 'identifier') {
            havingObject.type = 'column';
            havingObject.name = currentToken.value;
          }
  
          currentTokenIndex++;
          currentToken = tokens[currentTokenIndex];
  
          if (currentToken.type === 'operator') {
            havingObject.operator = currentToken.value;
            currentTokenIndex++;
            currentToken = tokens[currentTokenIndex];
          } else {
            throw new Error('Expected operator but found: ' + currentToken.value);
          }
  
          if (currentToken.type === 'number') {
            havingObject.value = currentToken.value;
            groupByAst.having.push(havingObject);
          } else {
            throw new Error('Expected number but found: ' + currentToken.value);
          }
  
          currentTokenIndex++;
        }
      }
  
      currentTokenIndex++;
    }
  
    return groupByAst;
  }
  
  
   #orderByAst(tokens) {
     const orderByAst = [];
     if(tokens.length === 0) return orderByAst;
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
    if (currentToken.value !== 'ORDER') {
      throw new Error('Expected ORDER but found: ' + currentToken.value);
    }
    currentTokenIndex++;
  
    while (currentTokenIndex < tokens.length) {
      currentToken = tokens[currentTokenIndex];
  
      if (currentToken.type === 'separator') {
        currentTokenIndex++;
        continue;
      }
  
      const orderByObject = {};
  
      if (currentToken.type === 'identifier') {
        orderByObject.type = 'column';
        orderByObject.name = currentToken.value;
        currentToken = tokens[currentTokenIndex];

        currentTokenIndex++;
        if (currentToken?.type === 'keyword' && currentToken?.value === 'DESC') {
          orderByObject.order = 'DESC';
          currentTokenIndex++;
        } else {
          orderByObject.order = 'ASC';
        }
  
        orderByAst.push(orderByObject);
      }
  
      currentTokenIndex++;
    }
  
    return orderByAst;
   }
  
  ast(tokens) {
    const ast = {
      select: [],
      from: [],
      where: [],
      groupBy: [],
      orderBy: []
    };

    const selectIndex = tokens.findIndex(token => token.value === 'SELECT');
    const fromIndex = tokens.findIndex(token => token.value === 'FROM');
    const whereIndex = tokens.findIndex(token => token.value === 'WHERE');
    const groupByIndex = tokens.findIndex(token => token.value === 'GROUP');
    const orderByIndex = tokens.findIndex(token => token.value === 'ORDER');

    const selectTokens = tokens.slice(selectIndex, fromIndex);
    const fromTokens = tokens.slice(fromIndex, whereIndex !== -1 ? whereIndex : groupByIndex !== -1 ? groupByIndex : orderByIndex !== -1 ? orderByIndex : tokens.length);
    const whereTokens = whereIndex !== -1 ? tokens.slice(whereIndex, groupByIndex !== -1 ? groupByIndex : orderByIndex !== -1 ? orderByIndex : tokens.length) : [];
    const groupByTokens = groupByIndex !== -1 ? tokens.slice(groupByIndex, orderByIndex !== -1 ? orderByIndex : tokens.length) : [];
    const orderByTokens = orderByIndex !== -1 ? tokens.slice(orderByIndex, tokens.length) : [];

    ast.select = this.#selectAst(selectTokens);
    ast.from = this.#fromAst(fromTokens);
    ast.where = this.#whereAst(whereTokens);
    ast.groupBy = this.#groupByAst(groupByTokens);
    ast.orderBy = this.#orderByAst(orderByTokens);

    return ast;
  }


  #evaluateWhereExpression(whereAst, row) {
    if (whereAst.length === 0) {
      // Empty WHERE condition, return true
      return true;
    }

    const condition = whereAst[0];

    if (condition.type === 'logical_operator') {
      // Handle logical operators (AND, OR)
      const operator = condition.operator;
      const restOfAst = whereAst.slice(1);

      if (operator === 'AND') {
        // Evaluate both sides of the AND condition
        return (
          evaluateWhereExpression([restOfAst[0]], row) &&
          evaluateWhereExpression(restOfAst.slice(1), row)
        );
      } else if (operator === 'OR') {
        // Evaluate either side of the OR condition
        return (
          evaluateWhereExpression([restOfAst[0]], row) ||
          evaluateWhereExpression(restOfAst.slice(1), row)
        );
      }
    } else if (condition.type === 'column') {
      // Handle column comparison
      const columnName = condition.name;
      const expression = condition.expression;

      const leftValue = row[columnName];
      const operator = expression.operator.value;
      const rightValue = expression.right.value;

      // Evaluate the binary expression
      switch (operator) {
        case '=':
          return leftValue === rightValue;
        case '!=':
          return leftValue !== rightValue;
        case '>':
          return leftValue > rightValue;
        case '>=':
          return leftValue >= rightValue;
        case '<':
          return leftValue < rightValue;
        case '<=':
          return leftValue <= rightValue;
        default:
          throw new Error('Unsupported operator: ' + operator);
      }
    }

    // Invalid condition type
    throw new Error('Invalid WHERE condition: ' + JSON.stringify(condition));
  }

  loadCSV(csvFilePath, ast) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          if (this.#evaluateWhereExpression(ast.where, row)) {
            this.data.push(row);
          }
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
    const ast = this.ast(tokens);
    await this.loadCSV('./sample.csv', ast);
    console.log(this.data);
    return this.data;
  } 
}
module.exports = CSVDatabase;