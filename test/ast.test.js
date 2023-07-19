const tap = require('tap');
const AST = require('../lib/ast');

tap.test('AST', (t) => {
    t.test('parse - Parses SQL tokens into AST', (t) => {
        const tokens = [
            { type: 'keyword', value: 'SELECT' },
            { type: 'identifier', value: 'column1' },
            { type: 'separator', value: ',' },
            { type: 'identifier', value: 'column2' },
            { type: 'keyword', value: 'FROM' },
            { type: 'identifier', value: 'table' },
            { type: 'keyword', value: 'WHERE' },
            { type: 'identifier', value: 'column1' },
            { type: 'operator', value: '=' },
            { type: 'number', value: '10' },
            { type: 'keyword', value: 'GROUP' },
            { type: 'identifier', value: 'column1' },
            { type: 'keyword', value: 'HAVING' },
            { type: 'identifier', value: 'column2' },
            { type: 'operator', value: '>' },
            { type: 'number', value: '5' },
            { type: 'keyword', value: 'ORDER' },
            { type: 'identifier', value: 'column1' },
            { type: 'keyword', value: 'ASC' },
            { type: 'keyword', value: 'LIMIT' },
            { type: 'number', value: '10' },
        ];

        const ast = new AST(tokens);
        t.equal(ast.select.length, 2, 'Correct number of select columns');
        t.equal(ast.select[0].type, 'column', 'First select column has correct type');
        t.equal(ast.select[0].name, 'column1', 'First select column has correct name');
        t.equal(ast.select[1].type, 'column', 'Second select column has correct type');
        t.equal(ast.select[1].name, 'column2', 'Second select column has correct name');
        t.equal(ast.from.length, 1, 'Correct number of from tables');
        t.equal(ast.from[0].type, 'table', 'First from table has correct type');
        t.equal(ast.from[0].name, 'table', 'First from table has correct name');
        t.equal(ast.where.length, 1, 'Correct number of where conditions');
        t.equal(ast.where[0].type, 'column', 'Where condition has correct type');
        t.equal(ast.where[0].expression.type, 'binary_expression', 'Where condition has correct expression type');
        t.equal(ast.where[0].expression.left.value, 'column1', 'Where condition has correct left operand');
        t.equal(ast.where[0].expression.operator.value, '=', 'Where condition has correct operator');
        t.equal(ast.where[0].expression.right.value, '10', 'Where condition has correct right operand');
        t.equal(ast.groupBy.columns.length, 1, 'Correct number of group by columns');
        t.equal(ast.groupBy.columns[0].type, 'column', 'Group by column has correct type');
        t.equal(ast.groupBy.columns[0].name, 'column1', 'Group by column has correct name');
        t.equal(ast.groupBy.having.length, 1, 'Correct number of having conditions');
        t.equal(ast.groupBy.having[0].type, 'column', 'Having condition has correct type');
        t.equal(ast.groupBy.having[0].name, 'column2', 'Having condition has correct name');
        t.equal(ast.groupBy.having[0].operator, '>', 'Having condition has correct operator');
        t.equal(ast.groupBy.having[0].value, '5', 'Having condition has correct value');
        t.equal(ast.orderBy.length, 1, 'Correct number of order by columns');
        t.equal(ast.orderBy[0].type, 'column', 'Order by column has correct type');
        t.equal(ast.orderBy[0].name, 'column1', 'Order by column has correct name');
        t.equal(ast.orderBy[0].order, 'ASC', 'Order by column has correct order');
        t.equal(ast.limit.value, '10', 'Limit has correct value');

        t.end();
    });

    t.test('compareSelectAst - Compares select AST with another select AST', (t) => {
        const tokens1 = [
            { type: 'keyword', value: 'SELECT' },
            { type: 'identifier', value: 'column1' },
            { type: 'keyword', value: 'FROM' },
            { type: 'identifier', value: 'table' },
        ];

        const tokens2 = [
            { type: 'keyword', value: 'SELECT' },
            { type: 'identifier', value: 'column1' },
            { type: 'separator', value: ',' },
            { type: 'identifier', value: 'column2' },
            { type: 'keyword', value: 'FROM' },
            { type: 'identifier', value: 'table' },
        ];

        const ast1 = new AST(tokens1);
        const ast2 = new AST(tokens2);

        const result1 = ast1.compareSelectAst(ast2.select); // Should be false
        const result2 = ast1.compareSelectAst(ast1.select); // Should be true

        t.equal(result1, false, 'Comparison with different select AST should be false');
        t.equal(result2, true, 'Comparison with same select AST should be true');

        t.end();
    });

    t.end();
});
