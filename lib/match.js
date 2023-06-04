// match.js

const match = (currentTokenIndex, tokens, expectedToken) => {
    console.log(currentTokenIndex, tokens, expectedToken);
    const token = tokens[currentTokenIndex];
    if (token.value === expectedToken) {
        return token.value;
    }
    throw new Error(`Expected token: ${expectedToken}, found: ${token.value}`);
};


module.exports = match;
