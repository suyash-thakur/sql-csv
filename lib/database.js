const fs = require('fs');
const csv = require('csv-parser');
const Tokenizer = require('./tokenizer');
const AST = require('./ast/ast');
class CSVDatabase {
  constructor(csvFilePath) {
    this.data = [];
    this.isLoaded = false;
  }

  //TODO: Break into smaller classes

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
              row[key] = this.#convertStringToDataType(row[key]);
              if (!data[key]) {
                data[key] = [];
              }
              data[key].push(row[key]);
            });
          } else if (name) {
            if (!data[alias]) {
              data[alias] = [];
            }
            row[name] = this.#convertStringToDataType(row[name]);
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

  #evaluateOrderByAst(orderByAst, rows) {
    const sortedRows = rows.sort((row1, row2) => {
      for (const orderByObject of orderByAst) {
        const { name, order } = orderByObject;
        const leftValue = row1[name][0];
        const rightValue = row2[name][0];
        if (leftValue < rightValue) {
          return order === 'ASC' ? -1 : 1;
        } else if (leftValue > rightValue) {
          return order === 'ASC' ? 1 : -1;
        }
      }
    });
    return sortedRows;
  };

  #checkDataTypeOfString(value) {
    if (value === 'true' || value === 'false') {
      return 'boolean';
    } else if (!isNaN(Number(value))) {
      return 'number';
    } else if (new Date(value).toString() !== 'Invalid Date') {
      return 'date';
    } else {
      return 'string';
    }
  };

  #convertStringToDataType(value) {
    const dataType = this.#checkDataTypeOfString(value);
    if (dataType === 'boolean') {
      return value === 'true';
    } else if (dataType === 'number') {
      return Number(value);
    } else if (dataType === 'date') {
      return new Date(value);
    } else {
      return value;
    }
  };

  #formatDataInRow(data) {
    const formattedRows = [];
    const keys = Object.keys(data);

    //TODO: Remove Spread Operator
    const maxLength = Math.max(...keys.map(key => data[key].length));

    for (let i = 0; i < maxLength; i++) {
      const newRow = {};

      for (const key of keys) {
        const values = data[key];
        newRow[key] = [values[i]] || [];

        if (typeof newRow[key] === 'string') {
          newRow[key] = newRow[key].trim();
        }
      }

      formattedRows.push(newRow);
    }
    return formattedRows;
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
    const tokenizer = new Tokenizer();
    const tokens = tokenizer.tokenize(sql);

    const ast = new AST(tokens);
    ast.parse();

    console.dir({ ast1: ast }, { depth: null });


    await this.loadCSV('./sample.csv', ast);
    if (ast.groupBy.columns.length > 0) {
      this.data = this.#evaluateGroupByAst(ast.groupBy, this.data);
      const groupByColumns = this.#getGroupByColumns(ast.groupBy);
      this.data = this.#evaluateSelectForGroupBy(ast.select, this.data, groupByColumns);
    } else {
      this.data = this.#evaluateSelectAst(ast.select, this.data);
      this.data = this.#formatDataInRow(this.data);
    }
    this.data = this.#evaluateOrderByAst(ast.orderBy, this.data);
    return this.data;
  }
}
module.exports = CSVDatabase;
