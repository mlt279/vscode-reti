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
export function parseDotReti(document) {
    document.getText();
    let instructionStrings = document.getText()
        .split(/\r?\n/)
        .map(line => line.split(';')[0].trim())
        .filter(instruction => instruction !== '');
    let instructionsSplit = instructionStrings.map(instruction => instruction.split(' ').map(component => component.trim()).filter(component => component !== ""));
    return instructionsSplit;
}
export function parseDotRetiAs(document) {
    document.getText();
    let code = document.getText().split(/\r?\n/);
    let instructions = [];
    for (let i = 0; i < code.length; i++) {
        instructions[i] = parseInt(code[i].split(';')[0].trim(), 16);
    }
    return instructions;
}
//# sourceMappingURL=parser.js.map