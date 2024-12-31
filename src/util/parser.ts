import * as vscode from 'vscode';
import * as path from 'path';

// This function takes the file as vscode.TextDocument type and returns the contents as a string.
export function parse(document: vscode.TextDocument): string[][]
{
    const fileExtension = path.extname(document.uri.fsPath);

    if (fileExtension === '.reti') {
        return parseDotReti(document);
    } else if (fileExtension === '.retias') {
        return parseDotRetiAs(document);
    } else {
        vscode.window.showErrorMessage("Unsupported file type. Please use .reti or .retias files.");
        return [];
    }
}

// Takes a valid .reti document and returns an array containing each instruction split into its components.
function parseDotReti(document: vscode.TextDocument): string[][] {
    document.getText();
    let instructionStrings: string[] = document.getText()
                                                .split(/\r?\n/)
                                                .map(line => line.split(';')[0].trim())
                                                .filter(instruction => instruction !== '');  
    let instructionsSplit: string[][] = instructionStrings.map(instruction => instruction.split(' ').map(component => component.trim()).filter(component => component !== ""));
    return instructionsSplit;
}

function parseDotRetiAs(document: vscode.TextDocument):string[][] {
    /* TODO:
    How are the assembly files represented by Armin Bieres project.
    How might I parse them -> In what format do I need them to be to process them in the emulator.
    */
   return [];
}