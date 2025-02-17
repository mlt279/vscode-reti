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
class InstructionPatterns {
    static move = /(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i;
    static store = /(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i;
    static load = /(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i;
    static jump = /(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i;
    static nop = /(?<=(^|\s))NOP(?!(\w|>|=|≥|<|≠|≤))/i;
    static compute = /(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i;
}

enum InstructionType {
    move = "MOVE",
    store = "STORE",
    load = "LOAD",
    jump = "JUMP",
    nop = "NOP",
    compute = "COMPUTE"
}

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
        let instructionType: InstructionType | null = null;

        if (tokens[0] === "") {
            return;
        }

        if (InstructionPatterns.move.test(tokens[0])) {
            instructionType = InstructionType.move;
        }
        
        if (InstructionPatterns.store.test(tokens[0])) {
            instructionType = InstructionType.store;
        }
        
        if (InstructionPatterns.load.test(tokens[0])) {
            instructionType = InstructionType.load;
        }
        
        if (InstructionPatterns.jump.test(tokens[0])) {
            instructionType = InstructionType.jump;
        }
        
        if (InstructionPatterns.nop.test(tokens[0])) {
            instructionType = InstructionType.nop;
        }
        
        if (InstructionPatterns.compute.test(tokens[0])) {
            instructionType = InstructionType.compute;
        }

        switch (instructionType) {

            // NOP instructions should not have any operands.
            case InstructionType.nop:
                if (tokens.length !== 1) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `NOP instruction does not take any operands.`,
                        source: "reti"
                    });
                }
                break;

            // MOVE instructions should be followed by a source and a destination register.
            // MOVE S D
            case InstructionType.move:
                if (tokens.length !== 3) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${instructionType} instruction requires exactly 2 operands.`,
                        source: "reti"
                    });
                }

                if (tokens[1] && !validRegisterPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${tokens[1]} is not a valid register.`,
                        source: "reti"
                    });
                }

                if (tokens[2] && !validRegisterPattern.test(tokens[2])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${tokens[2]} is not a valid register.`,
                        source: "reti"
                    });

                }

                return;                               

            // LOAD handles immediate as unsigned so a warning will be given if a negative number is used.
            // The rest of the pattern is checked in the case for COMPUTE as it is the same for both cases.
            case InstructionType.load:
                if(tokens[2] && tokens[2].startsWith('-') && tokens[0].toLowerCase() === "load") {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: {
                            start: { line: index, character: tokens[0].length + tokens[1].length + 2 },
                            end: { line: index, character: tokens[0].length + tokens[1].length + tokens[2].length + 2 }
                        },
                        message: `Immediate will be treated as unsigned. Negative numbers might not behave as expected.`,
                        source: 'reti'
                    });
                }
            // COMPUTE and LOAD instructions have the same pattern. They are handled by the same case.
            // Both should be followed by a source register and a number.
            // COMPUTE* D I || LOAD* D I
            case InstructionType.compute:
                if (tokens.length !== 3) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${instructionType} instruction requires exactly 2 operands.`,
                        source: "reti"
                    });
                }

                if (tokens[1] && !validRegisterPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${tokens[1]} is not a valid register.`,
                        source: "reti"
                    });
                }

                if (tokens[2] && !validNumberPattern.test(tokens[2])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${tokens[2]} is not a valid number.`,
                        source: "reti"
                    });
                }
                return;

            
            // STORE handles immediate as unsigned so a warning will be given if a negative number is used.
            // The rest of the pattern is checked in the case for COMPUTE as it is the same for both cases.
            case InstructionType.store:
                if(tokens[1] && tokens[1].startsWith('-') && tokens[0].toLowerCase() === "store") {
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
            // STORE and JUMP instructions have the same pattern. They are handled by the same case.
            // Both should be followed by a number and only have 2 tokens.
            // STORE* I || JUMP* I
            case InstructionType.jump:
                if (tokens.length > 2) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + tokens[1].length + 2},
                            end: { line: index, character: line.length }
                        },
                        message: `${instructionType} only takes one argument.`,
                        source: "reti"
                    });
                }

                if (tokens.length === 1) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length },
                            end: { line: index, character: line.length }
                        },
                        message: `${instructionType} requires an operand.`,
                        source: "reti"
                    });
                }

                if (tokens[1] && !validNumberPattern.test(tokens[1])) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: index, character: tokens[0].length + 1 },
                            end: { line: index, character: line.length }
                        },
                        message: `${tokens[1]} is not a valid number.`,
                        source: "reti"
                    });
                }
                break;
            default:
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: tokens[0].length }
                    },
                    message: "Invalid opcode.",
                    source: "reti"
                });
                return;
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

// TODO (Optional): Implement a hover provider that shows the actual effect of the instruction. 
// (e.g. MOVE IN1 IN2 -> IN2 := IN1 instead of D := S)
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
                        value: `**${tokens[tokenIndex]}**\n\nUsage: ${validInstructions[tokens[tokenIndex]].usage}\n\n\n\nResult: ${validInstructions[tokens[tokenIndex]].result} \n\n${validInstructions[tokens[tokenIndex]].documentation}`
                    }
                };
            }
        }
    }
    return null;
});

connection.listen();