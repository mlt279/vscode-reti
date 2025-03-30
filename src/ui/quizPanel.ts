import * as vscode from 'vscode';
import * as fs from 'fs';

export function showQuizPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'reti.quiz',
        'ReTI Quiz',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'static')]
        }
    );

    const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'static', 'quizPanel.html');

    fs.readFile(htmlPath.fsPath, 'utf8', (err, htmlContent) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to read HTML file');
            return;
        }

        // Convert all script and style paths to webview URIs
        const retiUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'static', 'reti.js'));

        const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'static', 'quizPanelvs.css'));
        const faviconUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'static', 'favicon.ico'));

        // Replace all paths dynamically
        htmlContent = htmlContent
            .replace('quizPanel.css', cssUri.toString())
            .replace('favicon.ico', faviconUri.toString())
            .replace('./reti.js', retiUri.toString());

        // Set the modified HTML
        panel.webview.html = htmlContent;
    });
}