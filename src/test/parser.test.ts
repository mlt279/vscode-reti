import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as parser from '../reti/parser';

suite('Parser Test Suite', async () => {
    vscode.window.showInformationMessage('Start all parser tests.');

    // #region Parse .reti file
    test("Open and parse a .reti file", async () => {
        const testFilePath = path.join(__dirname, "test.reti");
        const fileContent = "LOADI ACC 10;\nSTORE 1;\nSUBI ACC 1;\nJUMP= 2;\nJUMP -4;";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [
            ['LOADI', 'ACC', '10'],
            ['STORE', '1'],
            ['SUBI', 'ACC', '1'],
            ['JUMP=', '2'],
            ['JUMP', '-4'],
        ];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    test ("Open and parse an empty file", async () => {
        const testFilePath = path.join(__dirname, "testEmpty.reti");
        const fileContent = "";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    test ("Open and parse a file only consisting of ';'", async () => {
        const testFilePath = path.join(__dirname, "testSemicolon.reti");
        const fileContent = ";;;;;;;;;;;;;;;;;;;;;;;;;";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    test ("Open and parse a file with only one instruction", async () => {
        const testFilePath = path.join(__dirname, "testSingleInstruction.reti");
        const fileContent = "LOADI ACC 10;";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [
            ['LOADI', 'ACC', '10'],
        ];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    test ("Open and parse a file with only one instruction and a newline", async () => {
        const testFilePath = path.join(__dirname, "testSingleInstructionNewline.reti");
        const fileContent = "LOADI ACC 10;\n";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [
            ['LOADI', 'ACC', '10'],
        ];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    test ("Open and parse a file with multiple semicolons", async () => {
        const testFilePath = path.join(__dirname, "testMultipleSemicolons.reti");
        const fileContent = "LOADI ACC 10;\nSTORE 1;\n;;\nSUBI ACC 1\n;;;;\nJUMP= 2;\nJUMP -4;";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [
            ['LOADI', 'ACC', '10'],
            ['STORE', '1'],
            ['SUBI', 'ACC', '1'],
            ['JUMP=', '2'],
            ['JUMP', '-4'],
        ];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    test ("Open and parse a file with different linebreack characters (CR, LF)", async () => {
        const testFilePath = path.join(__dirname, "testLinebreaks.reti");
        const fileContent = "LOADI ACC 10;\rSTORE 1;\nSUBI ACC 1;\r\nJUMP= 2;\nJUMP -4;";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [
            ['LOADI', 'ACC', '10'],
            ['STORE', '1'],
            ['SUBI', 'ACC', '1'],
            ['JUMP=', '2'],
            ['JUMP', '-4'],
        ];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });

    // #endregion

    // #region Parse .retias file
    // #endregion

    test ("Open and parse an unsupported file type", async () => {
        const testFilePath = path.join(__dirname, "testUnsupported.txt");
        const fileContent = "LOADI ACC 10;\nSTORE 1;\nSUBI ACC 1;\nJUMP= 2;\nJUMP -4;";

        fs.writeFileSync(testFilePath, fileContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(document);

        let parsedData = parser.parse(document);

        let expectedData: string[][] = [];

        assert.deepStrictEqual(parsedData, expectedData);

        fs.unlinkSync(testFilePath);
    });
});