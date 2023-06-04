
const matchIdentifier = (currentTokenIndex, tokens) => {
    const token = tokens[currentTokenIndex];
    if (token.type === 'identifier') {
        return token.value;
    } else {
        throw new Error('Expected identifier but found: ' + token.value);
    }
};

module.exports = matchIdentifier;