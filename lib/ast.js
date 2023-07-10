const { getBetweenParenthesis } = require('./helper/util');

class AST {
  #tokens;
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

  parse() {
    const selectIndex = this.#tokens.findIndex(token => token.value === 'SELECT');
    const fromIndex = this.#tokens.findIndex(token => token.value === 'FROM');
    const whereIndex = this.#tokens.findIndex(token => token.value === 'WHERE');
    const groupByIndex = this.#tokens.findIndex(token => token.value === 'GROUP');
    const orderByIndex = this.#tokens.findIndex(token => token.value === 'ORDER');

    const selectTokens = this.#tokens.slice(selectIndex, fromIndex);
    const fromTokens = this.#tokens.slice(fromIndex, whereIndex !== -1 ? whereIndex : groupByIndex !== -1 ? groupByIndex : orderByIndex !== -1 ? orderByIndex : this.#tokens.length);
    const whereTokens = whereIndex !== -1 ? this.#tokens.slice(whereIndex, groupByIndex !== -1 ? groupByIndex : orderByIndex !== -1 ? orderByIndex : this.#tokens.length) : [];
    const groupByTokens = groupByIndex !== -1 ? this.#tokens.slice(groupByIndex, orderByIndex !== -1 ? orderByIndex : this.#tokens.length) : [];
    const orderByTokens = orderByIndex !== -1 ? this.#tokens.slice(orderByIndex, this.#tokens.length) : [];

    this.select = this.#parseSelect(selectTokens);
    this.from = this.#parseFrom(fromTokens);
    this.where = this.#parseWhere(whereTokens);
    this.groupBy = this.#parseGroupBy(groupByTokens);
    this.orderBy = this.#parseOrderBy(orderByTokens);
  }

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

  #parseWhere(tokens) {
    const whereAst = [];
    if (tokens.length === 0) return whereAst;
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
}


module.exports = AST;