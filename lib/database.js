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

  #evaluateBinaryExpression(leftOperand, rightOperand, operator) {
    switch (operator) {
      case '+':
        return leftOperand + rightOperand;
      case '-':
        return leftOperand - rightOperand;
      case '*':
        return leftOperand * rightOperand;
      case '/':
        return leftOperand / rightOperand;
      case '=':
        return leftOperand === rightOperand;
      case '!=':
        return leftOperand !== rightOperand;
      case '<':
        return leftOperand < rightOperand;
      case '>':
        return leftOperand > rightOperand;
      case '<=':
        return leftOperand <= rightOperand;
      case '>=':
        return leftOperand >= rightOperand;
      // Add more cases for other binary operators if needed
      default:
        throw new Error('Unsupported binary operator: ' + operator);
    }
  }

  #evaluateExpression(expression, row) {
    if (expression.type === 'identifier') {
      // Column name reference
      return row[expression.value];
    } else if (expression.type === 'number' || expression.type === 'string' || expression.type === 'literal' || expression.type === 'boolean') {
      // Numeric value
      return parseFloat(expression.value);
    } else if (expression.type === 'binary_expression') {
      // Recursive evaluation of binary expressions
      const left = evaluateExpression(expression.left, row);
      const right = evaluateExpression(expression.right, row);
      const operator = expression.operator.value;

      return this.#evaluateBinaryExpression(left, right, operator);
    } else {
      throw new Error('Invalid expression type: ' + expression.type);
    }
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
      return this.#evaluateBinaryExpression(leftValue, rightValue, operator);
    } else {
      // Invalid condition type
      throw new Error('Invalid WHERE condition: ' + JSON.stringify(condition));
    }
  }

  #evaluateSelectAst(selectAst, rows) {
    const data = {};
    let aggregateData = {}; // Object to store aggregate function results
    let currIndex = 0;
    selectAst.forEach((selectObject) => {
      currIndex++;

      for (let i = 0; i < rows.length; i++) {
        // console.dir({ rows }, { depth: null });
        const row = rows[i];
        const { type, expression, name } = selectObject;
        let { alias } = selectObject;
        if (!alias) alias = name;
        if (type === 'column') {
          if (name === '*') {
            Object.keys(row).forEach(key => {
              if (!data[key]) {
                data[key] = [];
              }
              data[key].push(row[key]);
            });
          } else if (name) {
            if (!data[alias]) {
              data[alias] = [];
            }
            data[alias].push(row[name]);
          }
        } else if (type === 'binary_expression') {
          const left = this.#evaluateExpression(selectObject.left, row);
          const right = this.#evaluateExpression(selectObject.right, row);
          const operator = selectObject.operator.value;
          const value = this.#evaluateBinaryExpression(left, right, operator);

          if (!data[alias]) {
            data[alias] = [];
          }
          data[alias].push(value);
        }

        if (expression) {
          if (expression.type === 'binary_expression') {
            const left = this.#evaluateExpression(expression.left, row);
            const right = this.#evaluateExpression(expression.right, row);
            const operator = expression.operator.value;
            const value = this.#evaluateBinaryExpression(left, right, operator);

            if (!data[alias]) {
              data[alias] = [];
            }
            data[alias].push(value);
          } else if (expression.type === 'function') {
            const { name, arguments: args } = expression;
            if (['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'].includes(name)) {
              const columnName = args[0].value;
              let columnValue = Number(row[columnName]) || 0;

              if (typeof columnValue !== 'number') {
                columnValue = 0;
              }

              if (!aggregateData[alias]) {
                aggregateData[alias] = 0;
              }

              if (name === 'SUM') {
                aggregateData[alias] += columnValue;
              } else if (name === 'AVG') {
                aggregateData[alias] += columnValue;
                if (!data[alias]) {
                  data[alias] = [];
                }
                data[alias].push(aggregateData[alias] / (i + 1));
              } else if (name === 'MIN') {
                if (!data[alias]) {
                  data[alias] = [];
                }
                data[alias].push(Math.min(columnValue));
              } else if (name === 'MAX') {
                if (!data[alias]) {
                  data[alias] = [];
                }
                data[alias].push(Math.max(columnValue));
              } else if (name === 'COUNT') {
                if (!data[alias]) {
                  data[alias] = [];
                }
                data[alias].push(columnValue.length);
              }
            }
          }
        }
      }
      if (Object.keys(aggregateData).length > 0) {
        for (let key in aggregateData) {
          if (!data[key]) {
            data[key] = [];
          }
          data[key] = [aggregateData[key]];
        }
        aggregateData = {};
      };
    });

    return data;
  }

  #getGroupByColumns(groupByAst) {
    const groupByColumns = groupByAst.columns.map(column => column.name);
    return groupByColumns;
  }

  #evaluateGroupByAst(groupByAst, rows) {
    const data = {};
    const { columns, having } = groupByAst;

    if (columns.length === 0) {
      return rows;
    }

    const groupByColumns = this.#getGroupByColumns(groupByAst);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const groupByValues = groupByColumns.map(column => row[column]).join('-');
      if (!data[groupByValues]) {
        data[groupByValues] = [];
      }

      data[groupByValues].push(row);
    }

    if (having.length > 0) {
      const havingCondition = having[0];
      const { name, operator, value } = havingCondition;

      const filteredData = Object.keys(data).reduce((acc, key) => {
        const row = data[key][0];
        const leftValue = row[name];
        const rightValue = value;

        if (this.#evaluateBinaryExpression(leftValue, rightValue, operator)) {
          acc[key] = data[key];
        }

        return acc;
      }, {});

      return filteredData;
    }

    return data;
  }

  #evaluateSelectForGroupBy(selectAst, data, groupByColumns) {

    const rows = [];

    // Iterate over each group
    for (const groupKey in data) {
      const groupRows = data[groupKey];
      // Iterate over each row within the group
      const evaluatedRow = this.#evaluateSelectAst(selectAst, groupRows);
      for (const column of groupByColumns) {
        evaluatedRow[column] = groupRows[0][column];
      }
      rows.push(evaluatedRow);
    }

    return rows;
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
    if (ast.groupBy.columns.length > 0) {
      this.data = this.#evaluateGroupByAst(ast.groupBy, this.data);
      const groupByColumns = this.#getGroupByColumns(ast.groupBy);
      this.data = this.#evaluateSelectForGroupBy(ast.select, this.data, groupByColumns);
    } else {
      this.data = this.#evaluateSelectAst(ast.select, this.data);
    }
    return this.data;
  }
}
module.exports = CSVDatabase;
