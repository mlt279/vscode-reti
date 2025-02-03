import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
export class ReTILanguageClient {
    context;
    client;
    constructor(context) {
        this.context = context;
        const serverModule = this.context.asAbsolutePath(path.join('server', 'out', 'server.js'));
        let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
        let serverOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
        };
        let clientOptions = {
            documentSelector: [{ scheme: 'file', language: 'reti' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
            }
        };
        this.client = new LanguageClient('ReTI', 'ReTI Language Server', serverOptions, clientOptions);
        this.client.start();
    }
    deactivate() {
        if (!this.client) {
            return undefined;
        }
        return this.client.stop();
    }
}
//# sourceMappingURL=client.js.map