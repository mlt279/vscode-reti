import * as vscode from 'vscode';
import * as fs from 'fs';
export function showQuizPanel(context) {
    const panel = vscode.window.createWebviewPanel('retiQuiz', 'RETI Quiz', vscode.ViewColumn.One, { enableScripts: true });
    const generateQuizHTML = () => {
        const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src/content', 'quizPanel.html');
        const html = fs.readFileSync(htmlPath.fsPath, 'utf8');
        return html;
    };
    panel.webview.html = generateQuizHTML();
    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'reload') {
            panel.webview.html = generateQuizHTML();
        }
    }, undefined, context.subscriptions);
}
//# sourceMappingURL=quizPanelExtern.js.map