const tap = require('tap');
const Evaluator = require('../lib/evaluator');

tap.test('Evaluator', (t) => {
    const rows = [
        { column1: 10, column2: 20 },
        { column1: 5, column2: 15 },
        { column1: 15, column2: 25 },
    ];

    const ast = {
        select: [
            { type: 'column', name: 'column1' },
            { type: 'column', name: 'column2' },
        ],
        from: [{ type: 'table', name: 'table' }],
        where: [
            {
                type: 'column',
                name: 'column1',
                expression: {
                    type: 'binary_expression',
                    left: { type: 'identifier', value: 'column1' },
                    operator: { type: 'operator', value: '=' },
                    right: { type: 'number', value: '10' },
                },
            },
        ],
        groupBy: {
            columns: [{ type: 'column', name: 'column1' }],
            having: [{ type: 'column', name: 'column1', operator: '>', value: '5' }],
        },
        orderBy: [{ type: 'column', name: 'column1', order: 'ASC' }],
        limit: { value: '2' },
    };

    t.test('evaluateWhereExpression - Evaluates WHERE condition', (t) => {
        const evaluator = new Evaluator(ast);
        const result = evaluator.evaluateWhereExpression(rows[0]);
        t.equal(result, true, 'WHERE condition evaluates correctly');
        t.end();
    });

    t.test('evaluateGroupByAst - Evaluates GROUP BY clause', (t) => {
        const evaluator = new Evaluator(ast);

        const result = evaluator.evaluateGroupByAst(rows);
        const expectedResult = {
            '10': [{ column1: 10, column2: 20 }],
            '15': [{ column1: 15, column2: 25 }]
        };

        t.deepEqual(result, expectedResult, 'GROUP BY clause evaluates correctly');

        t.end();
    });

    t.test('getGroupByColumns - Returns group by columns', (t) => {
        const evaluator = new Evaluator(ast);

        const result = evaluator.getGroupByColumns();
        const expectedResult = ['column1'];

        t.deepEqual(result, expectedResult, 'Group by columns are correct');

        t.end();
    });

    t.test('evaluateSelectForGroupBy - Evaluates SELECT clause with GROUP BY', (t) => {
        const evaluator = new Evaluator(ast);

        const data = {
            '10': [{ column1: 10, column2: 20 }],
            '15': [{ column1: 15, column2: 25 }],
        };

        const groupByColumns = evaluator.getGroupByColumns();
        const result = evaluator.evaluateSelectForGroupBy(data, groupByColumns);

        const expectedResult = [
            { column1: [10], column2: [20] },
            { column1: [15], column2: [25] },
        ];

        t.deepEqual(result, expectedResult, 'SELECT clause with GROUP BY evaluates correctly');

        t.end();
    });

    t.test('evaluateOrderByAst - Evaluates ORDER BY clause', (t) => {
        const evaluator = new Evaluator(ast);
        const testData = [
            {
                column1: [10],
                column2: [20],
            },
            {
                column1: [15],
                column2: [25],
            },
            {
                column1: [5],
                column2: [15],
            },
        ];
        const result = evaluator.evaluateOrderByAst(testData);
        const expectedResult = [
            {
                column1: [5],
                column2: [15],
            },
            {
                column1: [10],
                column2: [20],
            },
            {
                column1: [15],
                column2: [25],
            },
        ];

        t.deepEqual(result, expectedResult, 'ORDER BY clause evaluates correctly');

        t.end();
    });

    t.test('evaluateSelectAst - Evaluates SELECT clause', (t) => {
        const evaluator = new Evaluator(ast);

        const testData = [
            {
                column1: [10],
                column2: [20],
            },
            {
                column1: [15],
                column2: [25],
            },
            {
                column1: [5],
                column2: [15],
            },
        ];

        const result = evaluator.evaluateSelectAst(testData);
        const expectedResult = {
            column1: [10, 15, 5],
            column2: [20, 25, 15],
        };
        t.deepEqual(result, expectedResult, 'SELECT clause evaluates correctly');

        t.end();
    });

    t.test('evaluateLimitAst - Evaluates LIMIT clause', (t) => {
        const evaluator = new Evaluator(ast);

        const testData = [
            {
                column1: [10],
                column2: [20],
            },
            {
                column1: [15],
                column2: [25],
            },
            {
                column1: [5],
                column2: [15],
            },
        ];

        const result = evaluator.evaluateLimitAst(testData);
        const expectedResult = [
            {
                column1: [10],
                column2: [20],
            },
            {
                column1: [15],
                column2: [25],
            },
        ];

        t.deepEqual(result, expectedResult, 'LIMIT clause evaluates correctly');

        t.end();
    });

    t.end();
});
