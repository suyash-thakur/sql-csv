const { getBetweenParenthesis } = require('./helper/util');


/**
 * Represents an Abstract Syntax Tree (AST) for a SQL query.
 */
class AST {
  #tokens;

  /**
   * Creates a new instance of the AST class.
   * @param {Array} tokens - An array of tokens representing a SQL query.
   * @throws {Error} If no tokens are provided.
   */
  constructor(tokens) {
    if (!tokens) {
      throw new Error('Invalid SQL query: No tokens provided');
    }
    this.select = [];
    this.from = [];
    this.where = [];
    this.groupBy = [];
    this.orderBy = [];
    this.#tokens = tokens;
    if (this.#tokens.length > 0) {
      this.parse();
    }
  }

  /**
    * Parses the SQL query tokens and generates an AST.
    */
  parse() {
    const selectIndex = this.#tokens.findIndex(token => token.value === 'SELECT');
    const fromIndex = this.#tokens.findIndex(token => token.value === 'FROM');
    const whereIndex = this.#tokens.findIndex(token => token.value === 'WHERE');
    const groupByIndex = this.#tokens.findIndex(token => token.value === 'GROUP');
    const orderByIndex = this.#tokens.findIndex(token => token.value === 'ORDER');
    const limitIndex = this.#tokens.findIndex(token => token.value === 'LIMIT');

    const selectTokens = this.#tokens.slice(selectIndex, fromIndex);
    const fromTokens = this.#tokens.slice(fromIndex, whereIndex !== -1 ? whereIndex : groupByIndex !== -1 ? groupByIndex : orderByIndex !== -1 ? orderByIndex : this.#tokens.length);
    const whereTokens = whereIndex !== -1 ? this.#tokens.slice(whereIndex, groupByIndex !== -1 ? groupByIndex : orderByIndex !== -1 ? orderByIndex : this.#tokens.length) : [];
    const groupByTokens = groupByIndex !== -1 ? this.#tokens.slice(groupByIndex, orderByIndex !== -1 ? orderByIndex : this.#tokens.length) : [];
    const orderByTokens = orderByIndex !== -1 ? this.#tokens.slice(orderByIndex, this.#tokens.length) : [];
    const limitTokens = limitIndex !== -1 ? this.#tokens.slice(limitIndex, this.#tokens.length) : [];

    this.select = this.#parseSelect(selectTokens);
    this.from = this.#parseFrom(fromTokens);
    this.where = this.#parseWhere(whereTokens);
    this.groupBy = this.#parseGroupBy(groupByTokens);
    this.orderBy = this.#parseOrderBy(orderByTokens);
    this.limit = this.#parseLimit(limitTokens);
  }

  /**
   * Parses the SELECT clause of a SQL query and generates an AST.
   * @param {Array} tokens - An array of tokens representing the SELECT clause of a SQL query.
   * @returns {Array} An array of objects representing the columns selected in the query.
   * Each object contains the following properties:
   * - type: The type of the column (always 'column').
   * - name: The name of the column.
   * - alias: The alias of the column (if specified).
   * - expression: An object representing a function expression (if specified).
   * - left: The left operand of a binary expression (if specified).
   * - operator: The operator of a binary expression (if specified).
   * - right: The right operand of a binary expression (if specified).
   * @throws {Error} If the first token is not 'SELECT'.
   */
  #parseSelect(tokens) {
    const selectAst = [];


    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];

    if (currentToken.value !== 'SELECT') {
      throw new Error('Expected SELECT but found: ' + currentToken.value);
    }
    currentTokenIndex++;
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
        const { betweenParenthesis, currentTokenIndex: updatedTokenIndex } = getBetweenParenthesis(tokens, currentTokenIndex);
        currentTokenIndex = updatedTokenIndex;
        currentSelectObject.expression = {
          type: 'function',
          name: operationName,
          arguments: betweenParenthesis
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
        handleBinaryExpression(currentTokenIndex);
      }

      currentTokenIndex++;
    }
    return selectAst;
  }

  /**
   * Parses the FROM clause of a SQL query and generates an AST.
   * @param {Array} tokens - An array of tokens representing the FROM clause of a SQL query.
   * @returns {Array} An array of objects representing the tables used in the query.
   * Each object contains the following properties:
   * - type: The type of the table (always 'table').
   * - name: The name of the table.
   * @throws {Error} If the first token is not 'FROM'.
   */
  #parseFrom(tokens) {
    const fromAst = [];
    if (tokens.length === 0) return fromAst;
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

  /**
   * Parses the WHERE clause of a SQL query and generates an AST.
   * @param {Array} tokens - An array of tokens representing the WHERE clause of a SQL query.
   * @returns {Array} An array of objects representing the conditions used in the WHERE clause of the query.
   * Each object contains the following properties:
   * - type: The type of the condition (either 'column', 'literal', 'subquery' or 'logical_operator').
   * - name: The name of the column (if type is 'column').
   * - value: The value of the literal (if type is 'literal').
   * - subqueryAst: An array of objects representing the AST of a subquery (if type is 'subquery').
   * - operator: The logical operator used in the condition (if type is 'logical_operator').
   * - expression: An object representing a binary expression (if type is 'column' and a binary expression is used).
   * @throws {Error} If the first token is not 'WHERE'.
   */
  #parseWhere(tokens) {
    const whereAst = [];
    if (tokens.length === 0) return whereAst;
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
    if (currentToken.value !== 'WHERE') {
      throw new Error('Expected WHERE but found: ' + currentToken.value);
    }
    currentTokenIndex++;

    /**
     * Finds the tokens between the opening and closing parentheses in a SQL query.
     * @function
     * @returns {Array} An array of tokens between the opening and closing parentheses.
     * @throws {Error} If the closing parenthesis is not found.
     */
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

    /**
     * Handles a binary expression in the WHERE clause of a SQL query.
     * @function
     * @returns {void}
     */
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

  /**
   * Parses the GROUP BY clause of a SQL query and generates an AST.
   * @param {Array} tokens - An array of tokens representing the GROUP BY clause of a SQL query.
   * @returns {Object} An object representing the GROUP BY clause of the query.
   * The object contains the following properties:
   * - columns: An array of objects representing the columns used in the GROUP BY clause of the query.
   * Each object contains the following properties:
   *   - type: The type of the column (always 'column').
   *   - name: The name of the column.
   * - having: An array of objects representing the conditions used in the HAVING clause of the query.
   * Each object contains the following properties:
   *   - type: The type of the condition (always 'column').
   *   - name: The name of the column.
   *   - operator: The operator used in the condition.
   *   - value: The value used in the condition.
   * @throws {Error} If the first token is not 'GROUP'.
   */
  #parseGroupBy(tokens) {
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

  /**
   * Parses the ORDER BY clause of a SQL query and generates an AST.
   * @param {Array} tokens - An array of tokens representing the ORDER BY clause of a SQL query.
   * @returns {Array} An array of objects representing the columns used in the ORDER BY clause of the query.
   * Each object contains the following properties:
   * - type: The type of the column (always 'column').
   * - name: The name of the column.
   * - order: The order in which to sort the column ('ASC' or 'DESC').
   * @throws {Error} If the first token is not 'ORDER'.
   */
  #parseOrderBy(tokens) {
    const orderByAst = [];
    if (tokens.length === 0) return orderByAst;
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
        currentTokenIndex++;
        currentToken = tokens[currentTokenIndex];
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

  /**
   * Parses the LIMIT clause of a SQL query and generates an AST.
   * @param {Array} tokens - An array of tokens representing the LIMIT clause of a SQL query.
   * @returns {Object} An object representing the LIMIT clause of the query.
   * The object contains the following properties:
   * - value: The value used in the LIMIT clause.
   * @throws {Error} If the first token is not 'LIMIT'.
   */
  #parseLimit(tokens) {
    const limitAst = {};
    if (tokens.length === 0) return limitAst;
    let currentTokenIndex = 0;
    let currentToken = tokens[currentTokenIndex];
    if (currentToken.value !== 'LIMIT') {
      throw new Error('Expected LIMIT but found: ' + currentToken.value);
    }
    currentTokenIndex++;

    while (currentTokenIndex < tokens.length) {
      currentToken = tokens[currentTokenIndex];

      if (currentToken.type === 'separator') {
        currentTokenIndex++;
        continue;
      }

      if (currentToken.type === 'number') {
        limitAst.value = currentToken.value;
      }

      currentTokenIndex++;
    }

    return limitAst;
  }

  /**
   * Compares the SELECT clause of a SQL query with the AST generated by the parser.
   * @param {Array} selectAst - An array of objects representing the SELECT clause of the query.
   * Each object contains the following properties:
   * - type: The type of the column (either 'column', 'literal', 'function' or 'expression').
   * - name: The name of the column (if type is 'column').
   * - alias: The alias of the column (if an alias is used).
   * - expression: An object representing a function or expression (if type is 'function' or 'expression').
   *   - type: The type of the function or expression.
   *   - name: The name of the function or expression.
   *   - arguments: An array of arguments used in the function or expression.
   * @returns {boolean} Returns true if the SELECT clause of the query matches the AST generated by the parser, false otherwise.
   */
  compareSelectAst(selectAst) {
    if (!selectAst) return false;
    if (this.select.length !== selectAst.length) return false;
    for (let i = 0; i < this.select.length; i++) {
      if (this.select[i].type !== selectAst[i].type) return false;
      if (this.select[i].name !== selectAst[i].name) return false;
      if (this.select[i].alias !== selectAst[i].alias) return false;
      if (this.select[i].expression?.type !== selectAst[i].expression?.type) return false;
      if (this.select[i].expression?.name !== selectAst[i].expression?.name) return false;
      if (this.select[i].expression?.arguments?.length !== selectAst[i].expression?.arguments?.length) return false;
      if (this.select[i].expression?.arguments?.length > 0) {
        for (let j = 0; j < this.select[i].expression?.arguments?.length; j++) {
          if (this.select[i].expression?.arguments[j] !== selectAst[i].expression?.arguments[j]) return false;
        }
      }
    }
    return true;
  }
}


module.exports = AST;