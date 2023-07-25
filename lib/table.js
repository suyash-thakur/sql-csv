const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const Evaluator = require('./evaluator');
const { formatDataInRow, isURL } = require('./helper/util');

/**
 * Represents a table object that can load data from a CSV file or URL and perform SQL-like queries on it.
 * @class
 */
class Table {
  /**
   * Creates a new instance of the Table class.
   * @constructor
   * @param {string} csvPath - The path or URL to the CSV file.
   * @param {Object} options - An optional object containing additional options.
   * @param {string} options.name - The name of the table. If not provided, it will be inferred from the CSV file path.
   */
  constructor(csvPath, { name } = {}) {
    this.name = name || csvPath.split('/').pop().split('.')[0];
    this.data = [];
    this.isLoaded = false;
    this.csvPath = csvPath;
    this.selectAST = null;
  }

  /**
   * Returns the name of the table.
   * @returns {string} The name of the table.
   */
  getName() {
    return this.name;
  }

  /**
   * Loads data from a CSV file or URL and filters it based on the provided SQL-like query.
   * @param {Object} ast - The abstract syntax tree representing the SQL-like query.
   * @returns {Promise} A promise that resolves when the data has been loaded and filtered.
   * @throws {Error} If the provided SQL-like query is invalid or no table is selected.
   */
  loadCSV(ast) {

    if (!ast) {
      throw new Error('Invalid SQL query: No table selected');
    }
    const evaluator = new Evaluator(ast);
    const csvFilePath = this.csvPath;
    if (isURL(csvFilePath)) {
      return new Promise((resolve, reject) => {
        axios({
          method: 'get',
          url: csvFilePath,
          responseType: 'stream',
        })
          .then((response) => {
            response.data
              .pipe(csv())
              .on('data', (row) => {
                if (evaluator.evaluateWhereExpression(row)) {
                  this.data.push(row);
                }
              })
              .on('end', () => {
                this.isLoaded = true;
                resolve();
              })
              .on('error', (error) => {
                reject(error);
              });
          })
          .catch((error) => {
            reject(error);
          });
      });
    } else {
      return new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
          .pipe(csv())
          .on('data', (row) => {
            if (!evaluator) {
              this.data.push(row);
            } else if (evaluator.evaluateWhereExpression(row)) {
              this.data.push(row);
            }
          })
          .on('end', () => {
            this.isLoaded = true;

            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    }
  }

  /**
   * Checks if a given function name is an aggregate function.
   * @private
   * @param {string} name - The name of the function to check.
   * @returns {boolean} True if the function is an aggregate function, false otherwise.
   */
  #isAggregateFunction(name) {
    return ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'].includes(name);
  }

  /**
   * Calculates the final aggregates for the selected data based on the provided aggregate properties.
   * @private
   * @param {Array} selectedData - The selected data to calculate the final aggregates for.
   * @param {Map} aggregateProperties - A map of aggregate properties to their aliases.
   * @returns {Object} An object containing the final aggregates.
   * @throws {Error} If an invalid aggregate function is used.
   */
  #calculateFinalAggregates(selectedData, aggregateProperties) {
    const finalAggregates = {};

    aggregateProperties.forEach((name, alias) => {
      if (!this.#isAggregateFunction(name)) {
        throw new Error(`Invalid SQL query: ${name} is not an aggregate function`);
      }

      if (name === 'COUNT') {
        finalAggregates[alias] = [selectedData.length];
      } else if (['SUM', 'AVG'].includes(name)) {
        const values = selectedData.map(row => row[alias].pop());
        const sum = values.reduce((acc, val) => acc + val, 0);
        if (name === 'SUM') {
          finalAggregates[alias] = [sum.toString()];
        } else if (name === 'AVG') {
          finalAggregates[alias] = [(sum / selectedData.length).toString()];
        }
      } else if (name === 'MIN') {
        finalAggregates[alias] = [(selectedData.reduce((acc, row) => Math.min(acc, row[alias]), Infinity)).toString()];
      } else if (name === 'MAX') {
        finalAggregates[alias] = [(selectedData.reduce((acc, row) => Math.max(acc, row[alias]), -Infinity)).toString()];
      }
    });
    return finalAggregates;
  }


  /**
   * Executes a SQL-like query on the loaded CSV data and returns the selected data.
   * @async
   * @param {Object} ast - The abstract syntax tree representing the SQL-like query.
   * @returns {Promise<Array>} A promise that resolves with the selected data.
   * @throws {Error} If no table is selected or the provided SQL-like query is invalid.
   */
  async query(ast) {
    if (!ast) {
      throw new Error('Invalid SQL query: No table selected');
    }
    if (!ast.compareSelectAst(this.selectAST)) {
      this.selectAST = ast.select;
      await this.loadCSV(ast);
    }

    const batchSize = 1000; // Set the desired batch size for processing

    const evaluator = new Evaluator(ast);
    let selectedData = [];
    if (ast.groupBy.columns.length > 0) {
      for (let i = 0; i < this.data.length; i += batchSize) {
        const chunk = this.data.slice(i, i + batchSize);
        let chunkResult = evaluator.evaluateGroupByAst(chunk);
        const groupByColumns = evaluator.getGroupByColumns();
        chunkResult = evaluator.evaluateSelectForGroupBy(chunkResult, groupByColumns);
        selectedData.push(...chunkResult);
      }
    } else {
      for (let i = 0; i < this.data.length; i += batchSize) {
        const chunk = this.data.slice(i, i + batchSize);
        let chunkResult = evaluator.evaluateSelectAst(chunk);
        chunkResult = formatDataInRow(chunkResult);

        selectedData.push(...chunkResult);
      }
    }
    selectedData = evaluator.evaluateOrderByAst(selectedData);
    selectedData = evaluator.evaluateLimitAst(selectedData);
    if (evaluator.aggregatedProperties?.size > 0) {
      const finalAggregates = this.#calculateFinalAggregates(selectedData, evaluator.aggregatedProperties);
      selectedData = [finalAggregates];
    }

    return selectedData;
  }
}

module.exports = Table;