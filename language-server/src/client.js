"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReTILanguageClient = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const node_1 = require("vscode-languageclient/node");
class ReTILanguageClient {
    context;
    client;
    constructor(context) {
        this.context = context;
        const serverModule = this.context.asAbsolutePath(path.join('server', 'out', 'server.js'));
        let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
        let serverOptions = {
            run: { module: serverModule, transport: node_1.TransportKind.ipc },
            debug: { module: serverModule, transport: node_1.TransportKind.ipc, options: debugOptions }
        };
        let clientOptions = {
            documentSelector: [{ scheme: 'file', language: 'reti' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
            }
        };
        this.client = new node_1.LanguageClient('ReTI', 'ReTI Language Server', serverOptions, clientOptions);
        this.client.start();
    }
    deactivate() {
        if (!this.client) {
            return undefined;
        }
        return this.client.stop();
    }
}
exports.ReTILanguageClient = ReTILanguageClient;
//# sourceMappingURL=client.js.map