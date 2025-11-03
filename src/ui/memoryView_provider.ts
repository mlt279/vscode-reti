import * as vscode from 'vscode';

export class MemoryViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'reti.memoryView';

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

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async message => {
			const session = vscode.debug.activeDebugSession;
            if (!session || session.type !== "reti" ) {return;}

            if (message.command === 'readMemory') {
                const result = await session.customRequest('retiMemRead', {
                count: message.count,
                address: message.address
                });
                
                // const buffer = Buffer.from(result.data, 'base64');
                // const words = [];
                // for (let i = 0; i < buffer.length; i += 4) {
                //     const word =
                //     buffer[i] |
                //     (buffer[i + 1] << 8) |
                //     (buffer[i + 2] << 16) |
                //     (buffer[i + 3] << 24);
                //     words.push(word >>> 0);
                // }
                webviewView.webview.postMessage({ command: 'updateMemory', data: result.data, start: message.address, count: message.count });
            } else if (message.command === 'writeMemory') {
                const result = await session.customRequest('retiMemWrite', { address: message.address, data: message.data });
            }

		});
	}

    public addColor() {
        if (this._view) {
            this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
            this._view.webview.postMessage({ type: 'addColor' });
        }
    }

    public clearColors() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'clearColors' });
        }
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

        // return `<!DOCTYPE html>
        //     <html lang="en">
        //     <head>
        //         <meta charset="UTF-8">

        //         <!--
        //             Use a content security policy to only allow loading styles from our extension directory,
        //             and only allow scripts that have a specific nonce.
        //             (See the 'webview-sample' extension sample for img-src content security policy examples)
        //         -->
        //         <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

        //         <meta name="viewport" content="width=device-width, initial-scale=1.0">

        //         <link href="${styleResetUri}" rel="stylesheet">
        //         <link href="${styleVSCodeUri}" rel="stylesheet">
        //         <link href="${styleMainUri}" rel="stylesheet">

        //         <title>Cat Colors</title>
        //     </head>
        //     <body>
        //         <ul class="color-list">
        //         </ul>

        //         <button class="read-button">Add Color</button>
        //         <button class="write-button">Add Color</button>

        //         <script nonce="${nonce}" src="${scriptUri}"></script>
        //     </body>
        //     </html>`;
        return `
            <html>
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
                    const address = document.getElementById('address_input').value;
                    const count = document.getElementById('count_input').value;
                    vscode.postMessage({ command: 'readMemory', address: address, count: count });
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
                });

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