import * as vscode from 'vscode';
import * as path from 'path';

// // This function takes the file as vscode.TextDocument type and returns the contents as a string.
// export function parse(document: vscode.TextDocument): string[][]
// {
//     const fileExtension = path.extname(document.uri.fsPath);

//     if (fileExtension === '.reti') {
//         return parseDotReti(document);
//     } else if (fileExtension === '.retias') {
//         return parseDotRetiAs(document);
//     } else {
//         vscode.window.showErrorMessage("Unsupported file type. Please use .reti or .retias files.");
//         return [];
//     }
// }

// Takes a valid .reti document and returns an array containing each instruction split into its components.
export function parseDotReti(document: vscode.TextDocument): string[][] {
    return parseString(document.getText());
}

export function parseString(code: string): string[][] {
    let instructionStrings: string[] = code.split(/\r?\n/).map(line => line.split(';')[0].trim()).filter(instruction => instruction !== '');  
    let instructionsSplit: string[][] = instructionStrings.map(instruction => instruction.split(' ').map(component => component.trim()).filter(component => component !== ""));
    return instructionsSplit;   
}

export function parseLine(line: string): string[] {
    let instruction = line.split(';')[0].trim();
    let split = instruction.split(' ').map(component => component.trim()).filter(component => component !== "");
    return split;
}

export function parseDotRetiAs(document: vscode.TextDocument): number[] {
    const raw = document.getText().replace(/\s+/g, '');
    const instructions: number[] = [];

    for (let i = 0; i < raw.length; i += 8) {
        let chunk = raw.slice(i, i + 8);
        if (chunk.length < 8) {
            chunk = chunk.padEnd(8, '0');
        }
        instructions.push(parseInt(chunk, 16));
    }

    return instructions;
}