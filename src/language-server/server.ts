import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
documents.listen(connection);

const validRegisters: { [key: string]: string } = {
    "ACC": "Accumulator",
    "PC": "Program Counter",
    "IN1": "Indexregister 1",
    "IN2": "Indexregister 2"
};
const validInstructionPatterns = [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))NOP(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i
];

const validInstructions: { [key: string]: [string, string] } = {
    "MOVE": ["Moves content of the first register to the second register. Result: D := S.", "MOVE S D"],
    "STORE": ["Stores the value of ACC register into the i-th memory cell. Result: M(i) := ACC", "STORE i"], 
    "STOREIN1": ["Stores the value of ACC register into the (i+IN1)-th memory cell. Result: M(i+IN1) := ACC", "STOREIN1 i"], 
    "STOREIN2": ["Stores the value of ACC register into the (i+IN2)-th memory cell. Result: M(i+IN2) := ACC", "STOREIN2 i"],
    "LOAD": ["Loads the value of the i-th memory cell into the destination register. Result: D := M(i)", "LOAD D i"], 
    "LOADI": ["Loads the value of i into the destination register. Result: D := i", "LOADI D i"], 
    "LOADIN1": ["Loads the value of the (i+IN1)-th memory cell into the destination register. Result: D := M(IN1+i)", "LOADIN1 D i"], 
    "LOADIN2": ["Loads the value of the (i+IN2)-th memory cell into the destination register. Result: D := M(IN1+i)", "LOADIN2 D i"],
    "JUMP": ["Increases the program counter by i. Result: PC := PC + i", "JUMP i"], 
    "JUMP>": ["Increases the program counter by i if ACC > 0. Result: if ACC > 0 then PC := PC + i else PC := PC + 1", "JUMP> i"], 
    "JUMP=": ["Increases the program counter by i if ACC = 0. Result: if ACC = 0 then PC := PC + i else PC := PC + 1", "JUMP= i"], 
    "JUMP≥": ["Increases the program counter by i if ACC ≥ 0. Result: if ACC ≥ 0 then PC := PC + i else PC := PC + 1", "JUMP≥ i"], 
    "JUMP<": ["Increases the program counter by i if ACC < 0. Result: if ACC < 0 then PC := PC + i else PC := PC + 1", "JUMP< i"], 
    "JUMP≠": ["Increases the program counter by i if ACC ≠ 0. Result: if ACC ≠ 0 then PC := PC + i else PC := PC + 1", "JUMP≠ i"], 
    "JUMP≤": ["Increases the program counter by i if ACC ≤ 0. Result: if ACC ≤ 0 then PC := PC + i else PC := PC + 1", "JUMP≤ i"], 
    "NOP": ["Increase the program counter by 1 (does nothing). Result: PC := PC + 1", "NOP"],
    "ADD": ["Adds the value of the i-th memory cell to the value of the destination register. Result: D := D + M(i)", "ADD D i"], 
    "ADDI": ["Adds the value of i to the value of the destination register. Result: D := D + i", "ADDI D i"], 
    "SUB": ["Subtracts the value of the i-th memory cell from the value of the destination register. Result: D := D - M(i)", "SUB D i"], 
    "SUBI": ["Subtracts the value of i from the value of the destination register. Result: D := D - i", "SUBI D i"], 
    "OPLUS": ["Bitwise XNOR of the value of the i-th memory cell and the value of the destination register. Result: D := D ⊕ M(i)", "OPLUS D i"], 
    "OPLUSI": ["Bitwise XNOR of the value of i and the value of the destination register. Result: D := D ⊕ i", "OPLUSI D i"], 
    "AND": ["Bitwise AND of the value of the i-th memory cell and the value of the destination register. Result: D := D ∧ M(i)", "AND D i"], 
    "ANDI": ["Bitwise AND of the value of i and the value of the destination register. Result: D := D ∧ i", "ANDI D i"], 
    "OR": ["Bitwise OR of the value of the i-th memory cell and the value of the destination register. Result: D := D ∨ M(i)", "OR D i"], 
    "ORI": ["Bitwise OR of the value of i and the value of the destination register. Result: D := D ∨ i", "ORI D i"]
};

const validTokens = Object.keys(validRegisters).concat(Object.keys(validInstructions));

const validRegisterPattern = /(?<=(^|\s))(ACC|IN1|IN2|PC)(?!(\w|>|=|≥|<|≠|≤))/i;
const validNumberPattern = /(?<=^|\s)-?\d+(?!(\w|>|=|≥|<|≠|≤))/i;
// As soon as HEX/BIN is supported use this instead:
// const validNumberPattern = (?<=(^|\\s))((0b(0|1)+)|(0x[A-Ga-g0-9]+)|(-?\\d+))(?!(\\w|>|=|≥|<|≠|≤));

connection.onInitialize((params: InitializeParams) => {
    return {
        capabilities: {
            // Note: Change later on maybe to incremental. Check what type would be right.
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider: true
        }
    };
});

documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

function validateTextDocument(textDocument: TextDocument) {
    let diagnostics: Diagnostic[] = [];
    const lines = textDocument.getText().split(/\r?\n/);

    lines.forEach((line, index) => {
        const instruction = line.split(";")[0].trim();
        const tokens = instruction.split(/\s+/);
        if (tokens.length > 0) {
            if (tokens.length > 3) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: instruction.length }
                    },
                    message: `Instruction can have at most 3 tokens, found ${tokens.length}.`,
                    source: 'reti'
                });
            }

            // MOVE Instruction, should be followed by two registers.
            // MOVE S D
            if (/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (!validRegisterPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + 1  }
                        },
                        message: `MOVE should be followed by a register. ${tokens[1]} is not a valid source register.`,
                        source: 'reti'
                    });
                }

                if (!validRegisterPattern.test(tokens[2])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 2 }
                        },
                        message: `${tokens[2]} is not a valid destination register.`,
                        source: 'reti'
                    });
                }
            }

            // STORE Instruction, should be followed by exactly one register.
            // STORE* I
            if (/(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (tokens.length > 2) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
                        },
                        message: `Too many operands. STORE instruction only takes one operand.`,
                        source: 'reti'
                    });
                }

                if (!validNumberPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
                        },
                        message: `${tokens[1]} is not a valid number.`,
                        source: 'reti'
                    });
                }
                else {
                    if(tokens[1].startsWith('-')) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: {
                                start: { line: index, character: tokens[0].length + 1 },
                                end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
                            },
                            message: `Immediate will be treated as unsigned. Negative numbers might not behave as expected.`,
                            source: 'reti'
                        });
                    }
                }
            }

            // LOAD Instruction, should be followed by exactly one register and a number.
            // LOAD* D I
            if (/(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (!validRegisterPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: tokens[0].length }
                        },
                        message: `${tokens[1]} is not a valid register.`,
                        source: 'reti'
                    });
                }

                if (!validNumberPattern.test(tokens[2])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 2 }
                        },
                        message: `${tokens[2]} is not a known number.`,
                        source: 'reti'
                    });

                    if(tokens[1].startsWith('-') && !(tokens[0]).toLowerCase().endsWith('i')) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: {
                                start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                                end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 3 }
                            },
                            message: `Immediate will be treated as unsigned. Negative numbers might not behave as expected.`,
                            source: 'reti'
                        });
                    }
                }
            }

            // COMPUTE Instructions, should be followed by a valid register and a number.
            // COMPUTE D I
            if (/(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (!validRegisterPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: tokens[0].length }
                        },
                        message: `${tokens[1]} is not a valid register.`,
                        source: 'reti'
                    });
                }

                if (!validNumberPattern.test(tokens[2])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 2 }
                        },
                        message: `${tokens[2]} is not a known number.`,
                        source: 'reti'
                    });

                    if(tokens[1].startsWith('-') && !(tokens[0]).toLowerCase().endsWith('i')) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: {
                                start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                                end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 3 }
                            },
                            message: `Immediate will be treated as unsigned. Negative numbers might not behave as expected.`,
                            source: 'reti'
                        });
                    }
                }
            }
        }
    });
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// TODO: Look at how this works and how to implement it in a more intelligent way. Especially if 
// I want to auto-complete registers after instructions etc.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return validTokens.map(token => ({
            label: token
        }));
    }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return {
        ...item,
        detail: validRegisters[item.label] ? validRegisters[item.label] : validInstructions[item.label][1],
        documentation: validInstructions[item.label] ? validInstructions[item.label][0] : undefined,
        kind: validRegisters[item.label] ? CompletionItemKind.Variable : CompletionItemKind.Function
    };
});

connection.onHover((textDocumentposition: TextDocumentPositionParams) => {
    const document = documents.get(textDocumentposition.textDocument.uri);
    if (document) {
        const lines = document.getText().split(/\r?\n/);
        const line = lines[textDocumentposition.position.line];
        const instruction = line.split(";")[0].trim();
        const tokens = instruction.split(/\s+/);

        if (tokens.length > 0) {
            let tokenIndex = textDocumentposition.position.character;
            for (let i = 0; i < tokens.length; i++) {
                // Idea: Remove length from each token. Should the tokenindex become smaller than zero
                // we know that the character is between the start and the end of the current token.
                tokenIndex -= tokens[i].length;
                if (tokenIndex <= 0) {
                    tokenIndex = i;
                    break;
                }
                // Needed to account for the whitespaces between each token.
                tokenIndex -= 1;
            }
            if (validRegisters[tokens[tokenIndex]]) {
                return {
                    contents: {
                        kind: "markdown",
                        value: `**${tokens[tokenIndex]}**\n\n${validRegisters[tokens[tokenIndex]]}`
                    }
                };
            }

            if (validInstructions[tokens[tokenIndex]]) {
                return {
                    contents: {
                        kind: "markdown",
                        value: `**${tokens[tokenIndex]}**\n\n${validInstructions[tokens[tokenIndex]][0]}`
                    }
                };
            }
        }
    }
    return null;
});

connection.listen();