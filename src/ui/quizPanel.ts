import * as vscode from 'vscode';
import * as fs from 'fs';


/**
 * Creates and displays the quiz panel webview inside VS Code.
 * This function loads an HTML file, replaces necessary imports with secure URIs,
 * and sets up the webview for interaction.
 * 
 * @param {vscode.ExtensionContext} context - The extension context, used for resolving paths.
 */
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

        // Generate secure URIs for the JavaScript and CSS import to enable them to load in the webview.
        const retiUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'static', 'reti.js'));

        const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'static', 'quizPanelvs.css'));
        const faviconUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'static', 'favicon.ico'));

        htmlContent = htmlContent
            .replace('quizPanel.css', cssUri.toString())
            .replace('favicon.ico', faviconUri.toString())
            .replace('./reti.js', retiUri.toString());

        panel.webview.html = htmlContent;
    });
}
