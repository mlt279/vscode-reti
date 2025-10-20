"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const language_config_1 = require("./language_config");
let osMode = false;
let language_config = new language_config_1.LanguageConfig();
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
documents.listen(connection);
const operatorAliases = {
    "lt": "<",
    "eq": "=",
    "gt": ">",
    "leq": "≤",
    "geq": "≥",
    "neq": "≠",
    "<=": "≤",
    ">=": "≥",
    "!=": "≠"
};
connection.onInitialize((params) => {
    return {
        capabilities: {
            // Note: Change later on maybe to incremental. Check what type would be right.
            textDocumentSync: node_1.TextDocumentSyncKind.Full,
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider: true
        }
    };
});
connection.onNotification('reti/setMode', (mode) => {
    osMode = (mode === 'OS');
    language_config.setOsMode(osMode);
    connection.console.log(`Language Server: switched to ${mode} mode`);
    for (const document of documents.all()) {
        validateTextDocument(document);
    }
});
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
function validateTextDocument(textDocument) {
    let diagnostics = [];
    const lines = textDocument.getText().split(/\r?\n/);
    lines.forEach((line, index) => {
        if (line.trim().length === 0 || line.trim().startsWith(";")) {
            return;
        }
        const instruction = line.split(";")[0].trim();
        const tokens = instruction.split(/\s+/);
        const instruction_name = language_config.getInstructionName(tokens[0]);
        //#region Check for validity of instruction
        if (!instruction_name) {
            // Instruction is invalid
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Error,
                range: {
                    start: { line: index, character: 0 },
                    end: { line: index, character: instruction.length }
                },
                message: `Unknown instruction "${tokens[0]}".`,
                source: 'reti'
            });
        }
        else {
            //#endregion
            //#region Check for correct number of tokens.
            let num_operands = language_config.getNumOperands(instruction_name);
            if (tokens.length - 1 !== num_operands) {
                diagnostics.push({
                    severity: node_1.DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: instruction.length }
                    },
                    message: `Instruction of type '${instruction_name}' requires ${num_operands} operands, found ${tokens.length - 1}.`,
                    source: 'reti'
                });
                //#endregion
            }
            else {
                //#region Check for validity of operands.
                let valid = false;
                let temp_diagnostics = [];
                const instr_patterns = language_config.getInstructionSet()[instruction_name];
                for (let i = 0; i < instr_patterns.length; i++) {
                    const pattern = instr_patterns[i];
                    let pattern_fulfilled = true;
                    let current_token_start = 0;
                    for (let j = 0; j < pattern.length; j++) {
                        const type = pattern[j];
                        current_token_start += tokens[j].length + 1;
                        if (!language_config.isValidOperand(tokens[j + 1], type)) {
                            pattern_fulfilled = false;
                        }
                        temp_diagnostics.push({
                            severity: node_1.DiagnosticSeverity.Error,
                            range: {
                                start: { line: index, character: current_token_start },
                                end: { line: index, character: current_token_start + tokens[j + 1].length }
                            },
                            message: `Invalid operand.`,
                            source: 'reti'
                        });
                        //#region Give warnings for negative numbers when they will be treated as unsigned.
                        // TODO: Look up in powerpoint and recordings wether the cheatsheet is correct.
                        // Signed:
                        //  ti: 
                        //      loadin
                        //      loadi
                        //      storein
                        //      compi
                        //      jump
                        //  os:
                        //      loadi
                        //      (Meiner auffassung nach fehlt hier noch storein und loadin, laut cheatsheet sind die aber unsigned)
                        //      compi
                        //      jump
                        //      int (ist das richtig?, laut Tabelle ja, aber würde keinen Sinn ergeben oder?)
                        if (type === "unsigned" && language_config.getValidNumberPattern().test(tokens[j + 1]) && tokens[j + 1].startsWith("-")) {
                            diagnostics.push({
                                severity: node_1.DiagnosticSeverity.Warning,
                                range: {
                                    start: { line: index, character: current_token_start },
                                    end: { line: index, character: current_token_start + tokens[j + 1].length }
                                },
                                message: `Immediate will be treated as unsigned. Negative numbers might not behave as expected.`,
                                source: 'reti'
                            });
                        }
                        //#endregion
                    }
                    // If any of the pattern is fulfilled, the line of code is valid.
                    if (pattern_fulfilled) {
                        valid = true;
                    }
                }
                if (!valid) {
                    diagnostics.push(...temp_diagnostics);
                }
                //#endregion
            }
        }
    });
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onCompletion((_textDocumentPosition) => {
    return language_config.getValidTokens().map(token => ({
        label: token
    }));
});
connection.onCompletionResolve((item) => {
    return {
        ...item,
        // Registers don't have a documentation or a result so validInstructions has a different Format.
        // This means it is necessary to check if the item is a register.
        detail: language_config.getValidRegisters()[item.label] ? language_config.getValidRegisters()[item.label] : language_config.getDocumentation()[item.label].usage,
        documentation: language_config.getDocumentation()[item.label] ? language_config.getDocumentation()[item.label].documentation : undefined,
        kind: language_config.getValidRegisters()[item.label] ? node_1.CompletionItemKind.Variable : node_1.CompletionItemKind.Function
    };
});
connection.onHover((textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }
    const lineText = document.getText().split(/\r?\n/)[textDocumentPosition.position.line];
    const instructionText = lineText.split(";")[0];
    const tokens = instructionText.match(/\S+/g) || [];
    const charPos = textDocumentPosition.position.character;
    let tokenUnderCursor;
    let currentIndex = 0;
    for (let token of tokens) {
        const start = instructionText.indexOf(token, currentIndex);
        const end = start + token.length;
        if (charPos >= start && charPos <= end) {
            tokenUnderCursor = normalizeInstruction(token);
            break;
        }
        currentIndex = end;
    }
    if (!tokenUnderCursor) {
        return null;
    }
    if (language_config.getValidRegisters()[tokenUnderCursor]) {
        return {
            contents: {
                kind: "markdown",
                value: `**${tokenUnderCursor}**\n\n${language_config.getValidRegisters()[tokenUnderCursor]}`
            }
        };
    }
    if (language_config.getDocumentation()[tokenUnderCursor]) {
        return {
            contents: {
                kind: "markdown",
                value: `**${tokenUnderCursor}**\n\nUsage: ${language_config.getDocumentation()[tokenUnderCursor].usage}\n\nResult: ${language_config.getDocumentation()[tokenUnderCursor].result}\n\n${language_config.getDocumentation()[tokenUnderCursor].documentation}`
            }
        };
    }
    return null;
});
connection.listen();
// Function takes a token and replaces each operator that has an alias
// with its canonical form.
function normalizeInstruction(token) {
    return Object.keys(operatorAliases).reduce((acc, alias) => {
        return acc.split(alias).join(operatorAliases[alias]);
    }, token);
}
//# sourceMappingURL=server.js.map