import * as vscode from 'vscode';
import StoppedEvent from '@vscode/debugadapter';

export class MemoryViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'reti.memoryView';
    private _active: boolean = false;

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri,) 
    { 

    }

    public resolveWebviewView(webviewView: vscode.WebviewView,	_context: vscode.WebviewViewResolveContext,	_token: vscode.CancellationToken,) {
		this._view = webviewView;
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};
        const session = vscode.debug.activeDebugSession;
        if (session && session.type === "reti" ) {
		    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        } else {
            webviewView.webview.html = "<html></html>";
        }

		webviewView.webview.onDidReceiveMessage(async message => {
            const session = vscode.debug.activeDebugSession;
            if (!session || session.type !== "reti" ) {return;}

            if (message.command === 'readMemory') {
                const result = await this.readMemory(session, message.count, message.address);
                webviewView.webview.postMessage({ command: 'updateMemory', data: result.data, start: message.address, count: message.count });
            } else if (message.command === 'writeMemory') {
                const result = await session.customRequest('retiMemWrite', { address: message.address, data: message.data });
            }
		});

        vscode.debug.registerDebugAdapterTrackerFactory('reti', {
        createDebugAdapterTracker(session) {
            return {
            onDidSendMessage: msg => {
                if (msg.type === 'event' && msg.event === 'stopped') {
                const reason = msg.body?.reason ?? 'unknown';
                console.log('Stopped:', reason, 'in', session.name);
                webviewView.webview.postMessage({command: 'fetchMemory'});
                }
            }
            };
        }
        });

        vscode.debug.onDidTerminateDebugSession( async event => {
            this._active = false;
            webviewView.webview.html = "<html></html>";
        })

        vscode.debug.onDidStartDebugSession (async event => {
            if (vscode.debug.activeDebugSession?.type === "reti") {
                this._active = true;
            }
        })

        vscode.debug.onDidReceiveDebugSessionCustomEvent (async event => {
            if (vscode.debug.activeDebugSession?.type !== "reti") { return; }
        })

        vscode.debug.onDidChangeActiveDebugSession (async event => {
            if (vscode.debug.activeDebugSession?.type !== "reti") { 
                webviewView.webview.html = "<html></html>";
                return;
            }
            this._active = true;
            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
            webviewView.webview.postMessage({ command: 'fetchMemory'});
        })
	}
    
    private async readMemory(session: vscode.DebugSession, count: number, address: number){
        return await session.customRequest('retiMemRead', {
                count: count,
                address: address
                });
    }
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'memory_view', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'memory_view', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'memory_view', 'main.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();
        let html_code = `<html>
            <head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
			</head>
        <body style="font-family: sans-serif; padding: 10px;">
                <input id="address_input" placeholder="Address (hex or dec)">
                <input id="count_input" placeholder="Count (hex or dec)">
                <button id="read">Read</button>

                <table id="writeTable" border="1" cellspacing="0" cellpadding="4">
                    <thead>
                        <tr><th>Address</th><th>Value</th><th>Write</th></tr>
                    </thead>
                    <tbody>
                        <tr id="inputRow">
                            <td><input id="inputAddress" placeholder="0x00000000" style="width: 100%;"></td>
                            <td><input id="inputValue" placeholder="0x00000000" style="width: 100%;"></td>
                            <td><button id="write">Write</button></td>
                        </tr>
                    </tbody>
                </table>

                <table id="memTable" border="1" cellspacing="0" cellpadding="4">
                        <thead>
                            <tr><th>Address</th><th>Value</th></tr>
                        </thead>
                        <tbody id="memBody"></tbody>
                </table>

                <pre id="output"></pre>

                <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('read').onclick = () => {
                    read();
                };

                document.getElementById('write').onclick = () => {
                    const address = document.getElementById('inputAddress').value;
                    const data = document.getElementById('inputValue').value;
                    vscode.postMessage({ command: 'writeMemory', address: address, data: data });
                };

                window.addEventListener('message', (event) => {
                    const msg = event.data;
                    const data = msg.data;
                    const start = msg.start;
                    const count = msg.count;
                    if (msg.command === 'updateMemory') {
                        updateTable(start, data);
                    }

                    if (msg.command === 'fetchMemory') {
                        read();
                    }
                });

                function read(){
                    const address = document.getElementById('address_input').value;
                    const count = document.getElementById('count_input').value;
                    vscode.postMessage({ command: 'readMemory', address: address, count: count });
                }

                function updateTable(start, data) {
                    const body = document.getElementById('memBody');
                    body.innerHTML = '';

                    for (let i = 0; i < data.length; i++){
                        const address = start + i;
                        const row = document.createElement('tr');
                        let word = data[i];
                        row.innerHTML = \`
                            <td>\${address.toString(10)}</td>
                            <td>\${word.toString(10)}</td>
                        \`;
                        body.appendChild(row);
                    }
                }
                </script>
            </body>
            </html>
            `;
        return html_code;
            
    }
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
