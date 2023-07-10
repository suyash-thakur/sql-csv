const fs = require('fs');
const csv = require('csv-parser');
const Tokenizer = require('./tokenizer');
const Evaluator = require('./evaluator');
const AST = require('./ast');
const { formatDataInRow } = require('./helper/util');
class CSVDatabase {
  constructor(csvFilePath) {
    this.data = [];
    this.isLoaded = false;
  }



  loadCSV(csvFilePath, ast, evaluator) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
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
    });
  }

  async query(sql) {
    if (!this.isLoaded) {
      await this.loadCSVPromise;
    }
    const { tokens } = new Tokenizer(sql);
    const ast = new AST(tokens);
    const evaluator = new Evaluator(ast);



    await this.loadCSV('./sample.csv', ast, evaluator);
    if (ast.groupBy.columns.length > 0) {
      this.data = evaluator.evaluateGroupByAst(this.data);
      const groupByColumns = evaluator.getGroupByColumns();
      this.data = evaluator.evaluateSelectForGroupBy(this.data, groupByColumns);
    } else {
      this.data = evaluator.evaluateSelectAst(this.data);

      this.data = formatDataInRow(this.data);
    }
    this.data = evaluator.evaluateOrderByAst(this.data);
    return this.data;
  }
}
module.exports = CSVDatabase;
