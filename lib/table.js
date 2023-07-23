const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const Evaluator = require('./evaluator');
const { formatDataInRow, isURL } = require('./helper/util');

class Table {
  constructor(csvPath, { name } = {}) {
    this.name = name || csvPath.split('/').pop().split('.')[0];
    this.data = [];
    this.isLoaded = false;
    this.csvPath = csvPath;
    this.selectAST = null;
  }

  getName() {
    return this.name;
  }

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

  #isAggregateFunction(name) {
    return ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'].includes(name);
  }

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