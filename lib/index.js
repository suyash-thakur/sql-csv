const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const Tokenizer = require('./tokenizer');
const Evaluator = require('./evaluator');
const AST = require('./ast');
const { formatDataInRow, isURL } = require('./helper/util');
class CSVDatabase {
  constructor(csvFilePath) {
    this.data = [];
    this.isLoaded = false;
    this.csvPath = csvFilePath;
    this.selectAST = null;
  }



  loadCSV(evaluator) {
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

  async query(sql) {
    const { tokens } = new Tokenizer(sql);
    const ast = new AST(tokens);
    const evaluator = new Evaluator(ast);

    if (!ast.compareSelectAst(this.selectAST)) {
      this.selectAST = ast.select;
      await this.loadCSV(evaluator);
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
module.exports = CSVDatabase;
