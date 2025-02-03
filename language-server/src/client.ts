import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

export class ReTILanguageClient {
    private client: LanguageClient;

    constructor(private context: vscode.ExtensionContext) {
        const serverModule = this.context.asAbsolutePath(path.join('server', 'out', 'server.js'));
        let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

        let serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
        };

        let clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'reti' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
            }
        };

        this.client = new LanguageClient('ReTI', 'ReTI Language Server', serverOptions, clientOptions);
        this.client.start();
    }

    public deactivate(): Thenable<void> | undefined {
        if (!this.client) {
            return undefined;
        }
        return this.client.stop();
    }
}