const { evaluateBinaryExpression, convertStringToDataType } = require('./helper/util');
/**
 * Class representing an evaluator for a query AST.
 */
class Evaluator {
  #ast;
  /**
   * Creates an instance of Evaluator.
   * @param {Object} ast - The abstract syntax tree of the query.
   */
  constructor(ast) {
    this.#ast = ast;
    this.aggregatedProperties = new Map();
  }

  /**
   * Private method to evaluate an expression recursively.
   * @param {Object} expression - The expression to evaluate.
   * @param {Object} row - The row to evaluate the expression against.
   * @returns {number|string|boolean} - The evaluated value of the expression.
   * @throws {Error} - If the expression type is invalid.
   */
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

      return evaluateBinaryExpression(left, right, operator);
    } else {
      throw new Error('Invalid expression type: ' + expression.type);
    }
  }

  /**
   * Private method to evaluate a WHERE expression recursively.
   * @param {Object} row - The row to evaluate the expression against.
   * @returns {boolean} - The evaluated value of the expression.
   * @throws {Error} - If the expression type is invalid.
   */
  evaluateWhereExpression(row) {
    const whereAst = this.#ast.where;
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
      const operator = convertStringToDataType(expression.operator.value);
      const rightValue = convertStringToDataType(expression.right.value);

      // Evaluate the binary expression
      return evaluateBinaryExpression(leftValue, rightValue, operator);
    } else {
      // Invalid condition type
      throw new Error('Invalid WHERE condition: ' + JSON.stringify(condition));
    }
  }

  /**
   * Evaluates the GROUP BY clause of the query.
   * @param {Array} rows - The rows to group.
   * @returns {Object} - The grouped rows.
   */
  evaluateGroupByAst(rows) {
    const groupByAst = this.#ast.groupBy;
    const data = {};
    const { columns, having } = groupByAst;

    if (columns.length === 0) {
      return rows;
    }

    const groupByColumns = this.getGroupByColumns(groupByAst);

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
        const leftValue = convertStringToDataType(row[name]);
        const rightValue = convertStringToDataType(value);
        if (evaluateBinaryExpression(leftValue, rightValue, operator)) {
          acc[key] = data[key];
        }

        return acc;
      }, {});
      return filteredData;
    }

    return data;
  }
  /**
   * Returns an array of column names to group by.
   * @returns {Array} - An array of column names to group by.
   */
  getGroupByColumns() {
    const groupByAst = this.#ast.groupBy;
    const groupByColumns = groupByAst.columns.map(column => column.name);
    return groupByColumns;
  }

  /**
   * Evaluates the SELECT clause of the query for a GROUP BY statement.
   * @param {Object} data - The grouped rows.
   * @param {Array} groupByColumns - An array of column names to group by.
   * @returns {Array} - The evaluated rows.
   */
  evaluateSelectForGroupBy(data, groupByColumns) {
    const rows = [];

    // Iterate over each group
    for (const groupKey in data) {
      const groupRows = data[groupKey];
      // Iterate over each row within the group
      const evaluatedRow = this.evaluateSelectAst(groupRows);
      for (const column of groupByColumns) {
        evaluatedRow[column] = [groupRows[0][column]];
      }

      rows.push(evaluatedRow);
    }

    return rows;
  }

  /**
     * Evaluates the ORDER BY clause of the query.
     * @param {Array} rows - The rows to sort.
     * @returns {Array} - The sorted rows.
     */
  evaluateOrderByAst(rows) {
    const orderByAst = this.#ast.orderBy;
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

  /**
   * Evaluates the SELECT clause of the query.
   * @param {Array} rows - The rows to evaluate.
   * @returns {Object} - The evaluated rows.
   */
  evaluateSelectAst(rows) {
    const selectAst = this.#ast.select;
    const data = {};
    let aggregateData = {}; // Object to store aggregate function results
    let currIndex = 0;
    selectAst.forEach((selectObject) => {
      currIndex++;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const { type, expression, name } = selectObject;
        let { alias } = selectObject;
        if (!alias) alias = name;
        if (type === 'column') {
          if (name === '*') {
            Object.keys(row).forEach(key => {
              row[key] = convertStringToDataType(row[key]);
              if (!data[key]) {
                data[key] = [];
              }
              data[key].push(row[key]);
            });
          } else if (name) {
            if (!data[alias]) {
              data[alias] = [];
            }
            row[name] = convertStringToDataType(row[name]);
            data[alias].push(row[name]);
          }
        } else if (type === 'binary_expression') {
          const left = this.#evaluateExpression(selectObject.left, row);
          const right = this.#evaluateExpression(selectObject.right, row);
          const operator = selectObject.operator.value;
          const value = evaluateBinaryExpression(left, right, operator);

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
            const value = evaluateBinaryExpression(left, right, operator);

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
                if (!aggregateData[alias]) {
                  aggregateData[alias] = { sum: 0, count: 0 };
                }
                data[alias].push(aggregateData[alias] / rows.length);
              } else if (name === 'MIN') {
                if (!aggregateData[alias]) {
                  aggregateData[alias] = Infinity;
                }
                aggregateData[alias] = Math.min(columnValue, aggregateData[alias]);
              } else if (name === 'MAX') {
                if (!aggregateData[alias]) {
                  aggregateData[alias] = -Infinity;
                }
                aggregateData[alias] = Math.max(columnValue, aggregateData[alias]);
              } else if (name === 'COUNT') {
                if (!aggregateData[alias]) {
                  aggregateData[alias] = 0;
                }
                aggregateData[alias]++;
              }
              this.aggregatedProperties.set(alias, name);
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

  /**
   * Evaluates the LIMIT clause of the query.
   * @param {Array} rows - The rows to limit.
   * @returns {Array} - The limited rows.
   */
  evaluateLimitAst(rows) {
    const limitAst = this.#ast.limit;
    const { value } = limitAst;
    return rows.slice(0, value);
  }
}

module.exports = Evaluator;