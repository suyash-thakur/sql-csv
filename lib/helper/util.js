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

const evaluateBinaryExpression = (leftOperand, rightOperand, operator) => {
    switch (operator) {
        case '+':
            return leftOperand + rightOperand;
        case '-':
            return leftOperand - rightOperand;
        case '*':
            return leftOperand * rightOperand;
        case '/':
            return leftOperand / rightOperand;
        case '=':
            return leftOperand === rightOperand;
        case '!=':
            return leftOperand !== rightOperand;
        case '<':
            return leftOperand < rightOperand;
        case '>':
            return leftOperand > rightOperand;
        case '<=':
            return leftOperand <= rightOperand;
        case '>=':
            return leftOperand >= rightOperand;
        // Add more cases for other binary operators if needed
        default:
            throw new Error('Unsupported binary operator: ' + operator);
    }
}

const checkDataTypeOfString = (value) => {
    if (value === 'true' || value === 'false') {
        return 'boolean';
    } else if (!isNaN(Number(value))) {
        return 'number';
    } else if (new Date(value).toString() !== 'Invalid Date') {
        return 'date';
    } else {
        return 'string';
    }
};

const convertStringToDataType = (value) => {
    const dataType = checkDataTypeOfString(value);
    if (dataType === 'boolean') {
        return value === 'true';
    } else if (dataType === 'number') {
        return Number(value);
    } else if (dataType === 'date') {
        return new Date(value);
    } else {
        return value;
    }
};

const formatDataInRow = (data) => {
    const formattedRows = [];
    const keys = Object.keys(data);

    //TODO: Remove Spread Operator
    const maxLength = Math.max(...keys.map(key => data[key].length));

    for (let i = 0; i < maxLength; i++) {
        const newRow = {};

        for (const key of keys) {
            const values = data[key];
            newRow[key] = [values[i]] || [];

            if (typeof newRow[key] === 'string') {
                newRow[key] = newRow[key].trim();
            }
        }

        formattedRows.push(newRow);
    }
    return formattedRows;
}



module.exports = {
    getBetweenParenthesis,
    evaluateBinaryExpression,
    checkDataTypeOfString,
    convertStringToDataType,
    formatDataInRow
};