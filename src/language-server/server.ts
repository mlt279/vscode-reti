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

const validInstructions: { [key: string]: { documentation: string, usage: string, result: string } } = {
    "MOVE": { documentation: "Moves content of the first register to the second register.", usage: "MOVE S D", result: "D := S" },
    "STORE": { documentation: "Stores the value of ACC register into the i-th memory cell.", usage: "STORE i", result: "M(i) := ACC" }, 
    "STOREIN1": { documentation: "Stores the value of ACC register into the (i+IN1)-th memory cell.", usage: "STOREIN1 i", result: "M(i+IN1) := ACC" }, 
    "STOREIN2": { documentation: "Stores the value of ACC register into the (i+IN2)-th memory cell.", usage: "STOREIN2 i", result: "M(i+IN2) := ACC" },
    "LOAD": { documentation: "Loads the value of the i-th memory cell into the destination register.", usage: "LOAD D i", result: "D := M(i)" }, 
    "LOADI": { documentation: "Loads the value of i into the destination register.", usage: "LOADI D i", result: "D := i" }, 
    "LOADIN1": { documentation: "Loads the value of the (i+IN1)-th memory cell into the destination register.", usage: "LOADIN1 D i", result: "D := M(IN1+i)" }, 
    "LOADIN2": { documentation: "Loads the value of the (i+IN2)-th memory cell into the destination register.", usage: "LOADIN2 D i", result: "D := M(IN1+i)" },
    "JUMP": { documentation: "Increases the program counter by i.", usage: "JUMP i", result: "PC := PC + i" }, 
    "JUMP>": { documentation: "Increases the program counter by i if ACC > 0.", usage: "JUMP> i", result: "if ACC > 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP=": { documentation: "Increases the program counter by i if ACC = 0.", usage: "JUMP= i", result: "if ACC = 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≥": { documentation: "Increases the program counter by i if ACC ≥ 0.", usage: "JUMP≥ i", result: "if ACC ≥ 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP<": { documentation: "Increases the program counter by i if ACC < 0.", usage: "JUMP< i", result: "if ACC < 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≠": { documentation: "Increases the program counter by i if ACC ≠ 0.", usage: "JUMP≠ i", result: "if ACC ≠ 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≤": { documentation: "Increases the program counter by i if ACC ≤ 0.", usage: "JUMP≤ i", result: "if ACC ≤ 0 then PC := PC + i else PC := PC + 1" }, 
    "NOP": { documentation: "Increase the program counter by 1 (does nothing).", usage: "NOP", result: "PC := PC + 1" },
    "ADD": { documentation: "Adds the value of the i-th memory cell to the value of the destination register.", usage: "ADD D i", result: "D := D + M(i)" }, 
    "ADDI": { documentation: "Adds the value of i to the value of the destination register.", usage: "ADDI D i", result: "D := D + i" }, 
    "SUB": { documentation: "Subtracts the value of the i-th memory cell from the value of the destination register.", usage: "SUB D i", result: "D := D - M(i)" }, 
    "SUBI": { documentation: "Subtracts the value of i from the value of the destination register.", usage: "SUBI D i", result: "D := D - i" }, 
    "OPLUS": { documentation: "Bitwise XNOR of the value of the i-th memory cell and the value of the destination register.", usage: "OPLUS D i", result: "D := D ⊕ M(i)" }, 
    "OPLUSI": { documentation: "Bitwise XNOR of the value of i and the value of the destination register.", usage: "OPLUSI D i", result: "D := D ⊕ i" }, 
    "AND": { documentation: "Bitwise AND of the value of the i-th memory cell and the value of the destination register.", usage: "AND D i", result: "D := D ∧ M(i)" }, 
    "ANDI": { documentation: "Bitwise AND of the value of i and the value of the destination register.", usage: "ANDI D i", result: "D := D ∧ i" }, 
    "OR": { documentation: "Bitwise OR of the value of the i-th memory cell and the value of the destination register.", usage: "OR D i", result: "D := D ∨ M(i)" }, 
    "ORI": { documentation: "Bitwise OR of the value of i and the value of the destination register.", usage: "ORI D i", result: "D := D ∨ i" }
};

const operatorAliases: {[key: string] : string} = {
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
        if (line.trim().length === 0 || line.trim().startsWith(";")) {
            return; 
        }
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
                if (tokens.length < 3) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: instruction.length }
                        },
                        message: `MOVE instructions require two operands.`,
                        source: 'reti'
                    });   
                } else {
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
            }

            // STORE Instruction, should be followed by exactly one register.
            // STORE* I
            else if (/(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (tokens.length < 2) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: instruction.length }
                        },
                        message: `STORE instructions require one operand.`,
                        source: 'reti'
                    });   
                } else {
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
                    }}
            }

            // LOAD Instruction, should be followed by exactly one register and a number.
            // LOAD* D I
            else if (/(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (tokens.length < 3) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: instruction.length }
                        },
                        message: `LOAD instructions require two operands.`,
                        source: 'reti'
                    });   
                } else {
                    if (!validRegisterPattern.test(tokens[1])) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: index, character: tokens[0].length + 1 },
                                end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
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
                    }}
            }

            // COMPUTE Instructions, should be followed by a valid register and a number.
            // COMPUTE D I
            else if (/(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (tokens.length < 3) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: instruction.length }
                        },
                        message: `COMPUTE instructions require two operands.`,
                        source: 'reti'
                    });   
                } else { 
                    if (!validRegisterPattern.test(tokens[1])) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                                end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 2 }
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
                    }}
            }

            else if (/(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (tokens.length < 2) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: 0 },
                            end: { line: index, character: instruction.length }
                        },
                        message: `JUMP instructions require one operand.`,
                        source: 'reti'
                    });   
                } else { 
                    if (!validNumberPattern.test(tokens[1])) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: {
                                start: { line: index, character: tokens[0].length + 1 },
                                end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
                            },
                            message: `${tokens[1]} is not a known number.`,
                            source: 'reti'
                        });

                        if(tokens[1].startsWith('-')) {
                            diagnostics.push({
                                severity: DiagnosticSeverity.Warning,
                                range: {
                                    start: { line: index, character: tokens[0].length + 1 },
                                    end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
                                },
                                message: `If PC should fall < 0 unexpected behaviour might happen.`,
                                source: 'reti'
                            });
                        }
                    }}
            }

            else if (/(?<=(^|\s))NOP(?!(\w|>|=|≥|<|≠|≤))/i.test(tokens[0])) {
                if (tokens.length > 1) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + 1 }
                        },
                        message: `NOP instruction does not take any operands.`,
                        source: 'reti'
                    });
                }
            }

            // No valid opcode found at start of the line.
            else {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: tokens[0].length }
                    },
                    message: `Unknown instruction ${tokens[0]}.`,
                    source: 'reti'
                });
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
        // Registers don't have a documentation or a result so validInstructions has a different Format.
        // This means it is necessary to check if the item is a register.
        detail: validRegisters[item.label] ? validRegisters[item.label] : validInstructions[item.label].usage,
        documentation: validInstructions[item.label] ? validInstructions[item.label].documentation : undefined,
        kind: validRegisters[item.label] ? CompletionItemKind.Variable : CompletionItemKind.Function
    };
});

connection.onHover((textDocumentPosition: TextDocumentPositionParams) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {return null;}

    const lineText = document.getText().split(/\r?\n/)[textDocumentPosition.position.line];
    const instructionText = lineText.split(";")[0];

    const tokens = instructionText.match(/\S+/g) || [];

    const charPos = textDocumentPosition.position.character;
    let tokenUnderCursor: string | undefined;
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

    if (!tokenUnderCursor) {return null;}

    if (validRegisters[tokenUnderCursor]) {
        return {
            contents: {
                kind: "markdown",
                value: `**${tokenUnderCursor}**\n\n${validRegisters[tokenUnderCursor]}`
            }
        };
    }

    if (validInstructions[tokenUnderCursor]) {
        return {
            contents: {
                kind: "markdown",
                value: `**${tokenUnderCursor}**\n\nUsage: ${validInstructions[tokenUnderCursor].usage}\n\nResult: ${validInstructions[tokenUnderCursor].result}\n\n${validInstructions[tokenUnderCursor].documentation}`
            }
        };
    }

    return null;
});


connection.listen();

// Function takes a token and replaces each operator that has an alias
// with its canonical form.
function normalizeInstruction(token: string): string {
    return Object.keys(operatorAliases).reduce((acc, alias) => {
        return acc.split(alias).join(operatorAliases[alias]);
    }, token);
}