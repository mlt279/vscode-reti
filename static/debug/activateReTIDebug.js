/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/*
 * activateMockDebug.ts containes the shared extension code that can be executed both in node.js and the browser.
 */
'use strict';
import * as vscode from 'vscode';
import { ReTIDebugSession } from './retiDebugSession';
export function activateReTIDebug(context, factory) {
    context.subscriptions.push(vscode.commands.registerCommand('reti.debug.runEditorContents', (resource) => {
        let targetResource = resource;
        if (!targetResource && vscode.window.activeTextEditor) {
            targetResource = vscode.window.activeTextEditor.document.uri;
        }
        if (targetResource) {
            vscode.debug.startDebugging(undefined, {
                type: 'reti',
                name: 'Run File',
                request: 'launch',
                program: targetResource.fsPath
            }, { noDebug: true });
        }
    }), vscode.commands.registerCommand('reti.debug.debugEditorContents', (resource) => {
        let targetResource = resource;
        if (!targetResource && vscode.window.activeTextEditor) {
            targetResource = vscode.window.activeTextEditor.document.uri;
        }
        if (targetResource) {
            vscode.debug.startDebugging(undefined, {
                type: 'reti',
                name: 'Debug File',
                request: 'launch',
                program: targetResource.fsPath,
                stopOnEntry: true
            });
        }
    }), vscode.commands.registerCommand('reti.debug.toggleFormatting', (variable) => {
        const ds = vscode.debug.activeDebugSession;
        if (ds) {
            ds.customRequest('toggleFormatting');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('reti.debug.getProgramName', config => {
        return vscode.window.showInputBox({
            placeHolder: "Please enter the name of a reti file in the workspace folder",
            value: "readme.md"
        });
    }));
    const provider = new ReTIConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('reti', provider));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('reti', {
        provideDebugConfigurations(folder) {
            return [
                {
                    name: "Dynamic Launch",
                    request: "launch",
                    type: "reti",
                    program: "${file}"
                },
                {
                    name: "Another Dynamic Launch",
                    request: "launch",
                    type: "reti",
                    program: "${file}"
                },
                {
                    name: "ReTI Launch",
                    request: "launch",
                    type: "reti",
                    program: "${file}"
                }
            ];
        }
    }, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
    if (!factory) {
        factory = new InlineDebugAdapterFactory();
    }
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('reti', factory));
    if ('dispose' in factory && typeof factory.dispose === 'function') {
        context.subscriptions.push(factory);
    }
    // override VS Code's default implementation of the debug hover
    // here we match only Mock "variables", that are words starting with an '$'
    context.subscriptions.push(vscode.languages.registerEvaluatableExpressionProvider('reti', {
        provideEvaluatableExpression(document, position) {
            const VARIABLE_REGEXP = /\$[a-z][a-z0-9]*/ig;
            const line = document.lineAt(position.line).text;
            let m;
            while (m = VARIABLE_REGEXP.exec(line)) {
                const varRange = new vscode.Range(position.line, m.index, position.line, m.index + m[0].length);
                if (varRange.contains(position)) {
                    return new vscode.EvaluatableExpression(varRange);
                }
            }
            return undefined;
        }
    }));
    // override VS Code's default implementation of the "inline values" feature"
    context.subscriptions.push(vscode.languages.registerInlineValuesProvider('reti', {
        provideInlineValues(document, viewport, context) {
            const allValues = [];
            for (let l = viewport.start.line; l <= context.stoppedLocation.end.line; l++) {
                const line = document.lineAt(l);
                var regExp = /\$([a-z][a-z0-9]*)/ig; // variables are words starting with '$'
                do {
                    var m = regExp.exec(line.text);
                    if (m) {
                        const varName = m[1];
                        const varRange = new vscode.Range(l, m.index, l, m.index + varName.length);
                        // some literal text
                        //allValues.push(new vscode.InlineValueText(varRange, `${varName}: ${viewport.start.line}`));
                        // value found via variable lookup
                        allValues.push(new vscode.InlineValueVariableLookup(varRange, varName, false));
                        // value determined via expression evaluation
                        //allValues.push(new vscode.InlineValueEvaluatableExpression(varRange, varName));
                    }
                } while (m);
            }
            return allValues;
        }
    }));
}
class ReTIConfigurationProvider {
    /**
     * Massage a debug configuration just before a debug session is being launched,
     * e.g. add all missing attributes to the debug configuration.
     */
    resolveDebugConfiguration(folder, config, token) {
        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'reti') {
                config.type = 'reti';
                config.name = 'Launch';
                config.request = 'launch';
                config.program = '${file}';
                config.stopOnEntry = true;
            }
        }
        if (!config.program) {
            return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
                return undefined; // abort launch
            });
        }
        return config;
    }
}
export const workspaceFileAccessor = {
    isWindows: typeof process !== 'undefined' && process.platform === 'win32',
    async readFile(path) {
        let uri;
        try {
            uri = pathToUri(path);
        }
        catch (e) {
            return new TextEncoder().encode(`cannot read '${path}'`);
        }
        return await vscode.workspace.fs.readFile(uri);
    },
    async writeFile(path, contents) {
        await vscode.workspace.fs.writeFile(pathToUri(path), contents);
    }
};
function pathToUri(path) {
    try {
        return vscode.Uri.file(path);
    }
    catch (e) {
        return vscode.Uri.parse(path);
    }
}
class InlineDebugAdapterFactory {
    createDebugAdapterDescriptor(_session) {
        return new vscode.DebugAdapterInlineImplementation(new ReTIDebugSession(workspaceFileAccessor));
    }
}
//# sourceMappingURL=activateReTIDebug.js.map