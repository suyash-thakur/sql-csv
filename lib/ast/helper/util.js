const getBetweenParenthesis = (tokens, currentTokenIndex) => {
    const startIndex = currentTokenIndex;
    const endIndex = tokens.findIndex((token, index) => token.value === ')' && index > startIndex);
    if (endIndex === -1) {
        throw new Error('Invalid SQL query: Unterminated string literal');
    }
    const betweenParenthesis = tokens.slice(startIndex + 1, endIndex);
    currentTokenIndex = endIndex;
    return { betweenParenthesis, currentTokenIndex };
};

module.exports = {
    getBetweenParenthesis
};