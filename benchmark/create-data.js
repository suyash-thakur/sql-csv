const fs = require('fs');

const numberOfRows = 10000; // Adjust this number as needed
const numberOfColumns = 10;  // Adjust this number as needed

function generateRandomRow() {
    const row = [];
    for (let i = 0; i < numberOfColumns; i++) {
        // Generate a random number between 0 and 100
        const randomValue = Math.floor(Math.random() * 101);
        row.push(randomValue);
    }
    return row.join(',');
}

function generateCSVFile(filePath) {
    const writeStream = fs.createWriteStream(filePath);

    const headerRow = Array.from({ length: numberOfColumns }, (_, i) => `column${i + 1}`).join(',');
    writeStream.write(`${headerRow}\n`);

    for (let i = 0; i < numberOfRows; i++) {
        const rowData = generateRandomRow();
        writeStream.write(`${rowData}\n`);
    }

    writeStream.end();

    console.log(`CSV file "${filePath}" with ${numberOfRows} rows and ${numberOfColumns} columns has been generated.`);
}

const csvFilePath = `${__dirname}/largeData.csv`;

generateCSVFile(csvFilePath);
