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

const validRegisters = ["ACC", "PC", "IN1", "IN2"];
const validInstructions = ["JUMP", "LOAD", "STORE", "MOVE", "ADD", "SUB", "AND", "OR", "OPLUS"];
const validInstructionPatterns = [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))NOP(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i
];
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
            }
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

// TODO: Look at how this works and how to implement it. Especially if 
// I want to auto-complete registers after instructions etc.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return validInstructions.map(instr => ({
            label: instr,
            kind: CompletionItemKind.Keyword
        }));
    }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    // If you want to add more details, modify the item here
    return {
        ...item,
        detail: `ReTI instruction: ${item.label}`,
        documentation: `This is an instruction for the ReTI assembly language.`
    };
});


connection.listen();