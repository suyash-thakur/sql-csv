class Tokenizer {
  #keywords;
  #operators;
  #separators;
  #currentToken;
  constructor(sql) {
    this.#keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'SUM', 'COUNT', 'GROUP', 'ORDER', 'BY', 'AS', 'AVG', 'MIN', 'MAX', 'NOT', 'AND', 'OR', 'MAX', 'MIN', 'DISTINCT', 'ASC', 'DESC', 'HAVING'];
    this.#operators = ['=', '!=', '<', '>', '<=', '>=', '*', '+', '-', '/'];
    this.#separators = ['(', ')', ','];
    this.tokens = [];
    this.#currentToken = '';

    if (sql) {
      this.tokenize(sql);
    }
  }

  #addToken(type, value) {
    this.tokens.push({ type, value });
    this.#currentToken = '';
  }

  tokenize(sql) {
    let i = 0;
    while (i < sql.length) {
      const char = sql[i];
      if (char === ' ') {
        if (this.#currentToken !== '') {
          if (this.#keywords.includes(this.#currentToken.toUpperCase())) {
            this.#addToken('keyword', this.#currentToken.toUpperCase());
          } else if (!isNaN(Number(this.#currentToken))) {
            this.#addToken('number', this.#currentToken);
          } else {
            this.#addToken('identifier', this.#currentToken);
          }
        }
        i++;
      } else if (this.#separators.includes(char)) {
        if (this.#currentToken !== '') {
          if (this.#keywords.includes(this.#currentToken.toUpperCase())) {
            this.#addToken('keyword', this.#currentToken.toUpperCase());
          } else if (!isNaN(Number(this.#currentToken))) {
            this.#addToken('number', this.#currentToken);
          } else {
            this.#addToken('identifier', this.#currentToken);
          }
        }
        this.#addToken('separator', char);
        i++;
      } else if (char === '*') {
        if (this.#currentToken !== '') {
          if (this.#keywords.includes(this.#currentToken.toUpperCase())) {
            this.#addToken('keyword', this.#currentToken.toUpperCase());
          } else if (!isNaN(Number(this.#currentToken))) {
            this.#addToken('number', this.#currentToken);
          } else {
            this.#addToken('identifier', this.#currentToken);
          }
        }
        this.#addToken('identifier', char);
        i++;
      } else if (char === '"') {
        const startIndex = i;
        const endIndex = sql.indexOf('"', startIndex + 1);
        if (endIndex === -1) {
          throw new Error('Invalid SQL query: Unterminated string literal');
        }
        const value = sql.slice(startIndex + 1, endIndex);
        this.#addToken('identifier', value);
        i = endIndex + 1;
      } else if (char === "'") {
        const startIndex = i;
        const endIndex = sql.indexOf("'", startIndex + 1);
        if (endIndex === -1) {
          throw new Error('Invalid SQL query: Unterminated string literal');
        }
        const value = sql.slice(startIndex + 1, endIndex);
        this.#addToken('string', value);
        i = endIndex + 1;
      } else if (this.#operators.includes(char)) {
        if (this.#currentToken !== '') {
          if (this.#keywords.includes(this.#currentToken.toUpperCase())) {
            this.#addToken('keyword', this.#currentToken.toUpperCase());
          } else if (!isNaN(Number(this.#currentToken))) {
            this.#addToken('number', this.#currentToken);
          } else {
            this.#addToken('identifier', this.#currentToken);
          }
        }
        this.#addToken('operator', char);
        i++;
      } else if (/[a-zA-Z_]/.test(char)) {
        this.#currentToken += char;
        i++;
      } else if (/[0-9]/.test(char)) {
        this.#currentToken += char;
        i++;
      } else {
        throw new Error(`Invalid character: ${char}`);
      }
    }
    return this.tokens;
  }
}

module.exports = Tokenizer;