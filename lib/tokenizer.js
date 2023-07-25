/**
 * Tokenizer class that tokenizes SQL queries into individual tokens.
 * @class
 * @property {string[]} #keywords - An array of SQL keywords.
 * @property {string[]} #operators - An array of SQL operators.
 * @property {string[]} #separators - An array of SQL separators.
 * @property {string} #currentToken - The current token being processed.
 * @property {Object[]} tokens - An array of token objects with type and value properties.
 * @constructor
 * @param {string} sql - The SQL query to tokenize.
 */
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

  /**
   * Adds a token to the tokens array with the given type and value.
   * Resets the currentToken after adding the token.
   * @private
   * @param {string} type - The type of the token.
   * @param {string} value - The value of the token.
   */
  #addToken(type, value) {
    this.tokens.push({ type, value });
    this.#currentToken = '';
  }

  /**
   * Tokenizes SQL queries into individual tokens.
   * @public
   * @param {string} sql - The SQL query to tokenize.
   * @returns {Object[]} An array of token objects with type and value properties.
   * @throws {Error} Throws an error if the SQL query is invalid.
   */
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
          this.#currentToken = ''; // Reset currentToken after tokenizing
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
          this.#currentToken = ''; // Reset currentToken after tokenizing
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
          this.#currentToken = ''; // Reset currentToken after tokenizing
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
          this.#currentToken = ''; // Reset currentToken after tokenizing
        }
        let operator = char;
        const nextChar = sql[i + 1];
        if (nextChar === '=') {
          operator += nextChar;
          i++;
        }
        this.#addToken('operator', operator);
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
    if (this.#currentToken !== '') {
      if (this.#keywords.includes(this.#currentToken.toUpperCase())) {
        this.#addToken('keyword', this.#currentToken.toUpperCase());
      } else if (!isNaN(Number(this.#currentToken))) {
        this.#addToken('number', this.#currentToken);
      } else {
        this.#addToken('identifier', this.#currentToken);
      }
      this.#currentToken = ''; // Reset currentToken after tokenizing
    }
    return this.tokens;
  }
}

module.exports = Tokenizer;