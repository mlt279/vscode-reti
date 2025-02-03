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
            if (!validInstructions.includes(tokens[0])) {
                diagnostics.push({ 
                    severity: DiagnosticSeverity.Error,
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