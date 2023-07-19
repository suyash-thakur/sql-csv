const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const Evaluator = require('./evaluator');
const { formatDataInRow, isURL } = require('./helper/util');

class Table {
  constructor(csvPath, { name } = {}) {
    console.log('csvPath', csvPath, csvPath.split('/').pop().split('.')[0]);
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
                console.log('CSV file successfully processed');
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
            console.log('CSV file successfully processed');
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    }
  }

  async query(ast) {
    if (!ast) {
      throw new Error('Invalid SQL query: No table selected');
    }
    const evaluator = new Evaluator(ast);

    if (!ast.compareSelectAst(this.selectAST)) {
      this.selectAST = ast.select;
      await this.loadCSV(ast);
    }

    let selectedData = [...this.data];
    if (ast.groupBy.columns.length > 0) {
      selectedData = evaluator.evaluateGroupByAst(selectedData);
      const groupByColumns = evaluator.getGroupByColumns();
      selectedData = evaluator.evaluateSelectForGroupBy(selectedData, groupByColumns);
    } else {
      selectedData = evaluator.evaluateSelectAst(selectedData);

      selectedData = formatDataInRow(selectedData);
    }
    selectedData = evaluator.evaluateOrderByAst(selectedData);
    selectedData = evaluator.evaluateLimitAst(selectedData);
    return selectedData;
  }
}

module.exports = Table;