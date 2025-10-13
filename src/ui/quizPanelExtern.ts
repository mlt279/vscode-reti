import * as vscode from 'vscode';
import { randomInstruction } from '../util/randomReti';
import { decodeInstruction } from '../reti/ti/disassembler_ti';
import { binToHex, hexToBin } from '../util/retiUtility';
import * as fs from 'fs';

export function showQuizPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'retiQuiz',
        'RETI Quiz',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    const generateQuizHTML = (): string => {
        const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src/content', 'quizPanel.html');
        const html = fs.readFileSync(htmlPath.fsPath, 'utf8');
        return html;

    };  

    panel.webview.html = generateQuizHTML();

    panel.webview.onDidReceiveMessage(
        (message) => {
            if (message.command === 'reload') {
                panel.webview.html = generateQuizHTML();
            }
        },
        undefined,
        context.subscriptions
    );
}
