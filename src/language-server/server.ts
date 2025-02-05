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
import {TextDocument} from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
documents.listen(connection);

const validRegisters = ["ACC", "PC", "IN1", "IN2"];
const validInstructions = ["JUMP", "LOAD", "STORE", "MOVE", "ADD", "SUB", "AND", "OR", "OPLUS"];
const validInstructionPatterns = [/(?<=(^|\\s))MOVE(?!(\\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\\s))STORE(IN[12])?(?!(\\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\\s))LOAD(I|IN[12])?(?!(\\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\\s))NOP(?!(\\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\\w|>|=|≥|<|≠|≤))/i
];
const validRegisterPatterns = /(?<=(^|\\s))(ACC|IN1|IN2|PC)(?!(\\w|>|=|≥|<|≠|≤))/i;
const validNumberPatters = [/(?<=(^|\\s))-?\\d+(?!(\\w|>|=|≥|<|≠|≤))/];

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
            if (!validInstructionPatterns.some(pattern => pattern.test(instruction))) {
                diagnostics.push({ 
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: tokens[0].length }
                    },
                    message: `Unknown operation.}`,
                    source: 'reti'
                });
            }
        }
    });
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function isValidInstruction(instruction: string): boolean {
    return validInstructionPatterns.some(pattern => pattern.test(instruction));
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