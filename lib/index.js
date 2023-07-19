const Tokenizer = require('./tokenizer');
const AST = require('./ast');
const Table = require('./table');
class CSVDatabase {
  constructor(csvFilePaths) {
    this.data = [];
    this.isLoaded = false;
    this.csvPaths = csvFilePaths;
    this.selectAST = null;
    this.tables = [];
    for (let i = 0; i < this.csvPaths.length; i++) {
      this.tables.push(new Table(this.csvPaths[i]));
    }
  }




  async query(sql) {
    const { tokens } = new Tokenizer(sql);
    const ast = new AST(tokens);
    const from = ast.from?.[0]?.name;
    if (!from) {
      throw new Error('Invalid SQL query: No table selected');
    }
    let table = this.tables.find((table) => table.getName() === from);
    if (!table) {
      console.log(`Available tables: ${this.tables.map((table) => table.getName()).join(', ')}`);
      throw new Error(`Invalid SQL query: Table ${from} does not exist`);
    }
    const selectedData = await table.query(ast);
    return selectedData;
  }
}
module.exports = CSVDatabase;
