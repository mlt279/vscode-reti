"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const validRegisters = ["ACC", "PC", "IN1", "IN2"];
const validInstructions = ["JUMP", "LOAD", "STORE", "MOVE", "ADD", "SUB", "AND", "OR", "OPLUS"];
connection.onInitialize((params) => {
    return {
        capabilities: {
            // Note: Change later on maybe to incremental. Check what type would be right.
            textDocumentSync: node_1.TextDocumentSyncKind.Full,
            completionProvider: {
                resolveProvider: true
            }
        }
    };
});
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
function validateTextDocument(textDocument) {
    let diagnostics = [];
    const lines = textDocument.getText().split(/\r?\n/);
    lines.forEach((line, index) => {
        const instruction = line.split(";")[0].trim();
        const tokens = instruction.split(/\s+/);
        if (tokens.length > 0) {
            if (!validInstructions.includes(tokens[0])) {
                diagnostics.push({
                    severity: node_1.DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: tokens[0].length }
                    },
                    message: `Invalid instruction: ${tokens[0]}`,
                    source: 'reti'
                });
            }
        }
    });
}
// TODO: Look at how this works and how to implement it. Especially if 
// I want to auto-complete registers after instructions etc.
connection.onCompletion((_textDocumentPosition) => {
    return validInstructions.map(instr => ({
        label: instr,
        kind: node_1.CompletionItemKind.Keyword
    }));
});
connection.listen();
//# sourceMappingURL=server.js.map