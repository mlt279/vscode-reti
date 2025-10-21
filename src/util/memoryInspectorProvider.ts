import * as vscode from 'vscode';

export class MemoryInspectorProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'reti.memoryInspector';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // Called when the view becomes visible
  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml();

    // Handle messages coming from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      const ds = vscode.debug.activeDebugSession;
      if (!ds) {
        vscode.window.showWarningMessage('No active ReTI debug session.');
        return;
      }

      if (message.command === 'readMemory') {
        ds.customRequest('readMemory');
      } else if (message.command === 'writeMemory') {
        ds.customRequest('writeMemory');
      }
    });
  }

  // Called externally (e.g. on step/breakpoint) to refresh view
  public refresh() {
    if (this._view) {
      this._view.webview.postMessage({ command: 'refresh' });
    }
  }

  private _getHtml(): string {
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <body style="font-family: sans-serif; padding: 10px;">
          <h3>ReTI Memory Inspector</h3>
          <button id="readBtn">Read</button>
          <button id="writeBtn">Write</button>

          <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('readBtn').addEventListener('click', () => {
              vscode.postMessage({ command: 'readMemory' });
            });

            document.getElementById('writeBtn').addEventListener('click', () => {
              vscode.postMessage({ command: 'writeMemory' });
            });

            window.addEventListener('message', event => {
              const msg = event.data;
              if (msg.command === 'refresh') {
                console.log('Memory view refreshed');
              }
            });
          </script>
        </body>
      </html>
    `;
  }
}
