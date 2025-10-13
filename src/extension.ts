// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { Emulator } from './reti/ti/emulator_ti';
import { parseDotReti, parseDotRetiAs } from './util/parser';
import { showQuizPanel } from './ui/quizPanel';
import { randomInstruction, randomReti } from './util/randomReti';

import { binToHex, hexToBin } from './util/retiUtility';

import { assembleLine } from './reti/ti/assembler_ti';
import { decodeInstruction } from './reti/ti/disassembler_ti';

import { disassembleWord } from './reti/disassembler';

import * as AsmTI from './reti/ti/assembler_ti';
import * as AsmOS from './reti/os/assembler_os';

import { ReTI, stateToString } from './reti/ti/retiStructure_ti';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { ReTIConfig } from './config';

import * as Net from 'net';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { platform } from 'process';
import { ProviderResult } from 'vscode';
import { ReTIDebugSession } from './debug/retiDebugSession';
import { activateReTIDebug, workspaceFileAccessor } from './debug/activateReTIDebug';

const runMode: 'external' | 'server' | 'namedPipeServer' | 'inline' = 'inline';

let languageClient: LanguageClient | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {	

	const output = vscode.window.createOutputChannel('ReTI');
	output.appendLine('ReTI extension activated');
	output.appendLine(`Current ReTI mode: ${ReTIConfig.version}`);
	output.appendLine(`isTI: ${ReTIConfig.isTI}  isOS: ${ReTIConfig.isOS}`);

	context.subscriptions.push(output);


	const serverModule = context.asAbsolutePath(path.join('out', 'language-server', 'server.js'));
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

	languageClient = new LanguageClient('ReTI', 'ReTI Language Server', serverOptions, clientOptions);
	languageClient.start();


	let emulateTokenSource : vscode.CancellationTokenSource | undefined = undefined;

	const EmulateCommand = vscode.commands.registerCommand('reti.emulate', async () => {
		if (emulateTokenSource) {
			vscode.window.showErrorMessage("Emulation already in progress.");
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			let code: string[][] = [];
			let assembled: number[] = [];

			if (editor.document.languageId === 'reti') {
				code = parseDotReti(editor.document);
				if (code.length === 0) {
					vscode.window.showErrorMessage("No code to emulate.");
					return;
				}
				for (let line of code) {
					const [errcode, instruction, message] = assembleLine(line);
					if (errcode !== 0) {
						vscode.window.showErrorMessage(`Error when assembling: ${instruction} | ${message}`);
						return;
					}
					assembled.push(instruction);
				}
			}
			else if (editor.document.languageId === 'retias') {
				assembled = parseDotRetiAs(editor.document);
			}
			else {
				vscode.window.showErrorMessage("Unsupported file type. Please use .reti or .retias files.");
				return;
			}

			emulateTokenSource = new vscode.CancellationTokenSource();
			const outputChannel = vscode.window.createOutputChannel("ReTI Emulator");
			let emulator = new Emulator(assembled, [], outputChannel);
			try {
				vscode.window.showInformationMessage("Emulation started.");
				const finalState = await emulator.emulate(emulateTokenSource.token);
				outputChannel.appendLine(`Emulation finished. Final state: ${stateToString(finalState)}`);
				if (emulateTokenSource) {
					emulateTokenSource.cancel();
					emulateTokenSource.dispose();
					emulateTokenSource = undefined;
				}
				outputChannel.show();
				vscode.window.showInformationMessage(`Emulation finished. Final state: ${stateToString(finalState)}`);
			}
			catch (e) {
				// vscode.window.showErrorMessage(`Error when emulating: ${e}`);
				outputChannel.appendLine(`Error when emulating: ${e}`);
				outputChannel.show();
			}
		}
	});

	const StopEmulationCommand = vscode.commands.registerCommand('reti.stopEmulation', () => {
		if (emulateTokenSource) {
			emulateTokenSource.cancel();
			emulateTokenSource.dispose();
			emulateTokenSource = undefined;
		}
		else {
			vscode.window.showInformationMessage("No emulation to stop.");
		}
	});

	const QuizCommand = vscode.commands.registerCommand('reti.quiz', () => { 
		showQuizPanel(context);
	});

	const RandomCommand = vscode.commands.registerCommand('reti.generate', async () => {
		const val = await vscode.window.showInputBox({ prompt: "Enter desired length of random code (Max 4096). If left empty, a random length will be chosen." });
		
		const iSize = await vscode.window.showInputBox({ prompt: "Enter desired bitsize of the immediate value (Max 24). If left empty, the max size (24) will be chosen." });
		let iSizeVal = parseInt(iSize || "24");
		if (iSizeVal < 0) {
			iSizeVal = 0;
		}
		if (iSizeVal > 24) {
			iSizeVal = 24;
		}
		if (isNaN(iSizeVal)) {
			iSizeVal = 24; // Default to 24 bits if not specified
		}
		let code : number[] = [];
		if (val === undefined) {
			return;
		}
		else if (val === "") {
			code = randomReti(null, iSizeVal);
		}
		else {
			let value = parseInt(val);

			if (value < 0) { value = 0; }
			if (value > 4096) { value = 4096; }
			vscode.window.showInformationMessage(`Generating ${value} random instructions...`);
			for (let i = 0; i < value; i++) {
				code.push(randomInstruction(iSizeVal));
			}
		}

		let content = "";
    
		let maxInstructionLength = 0;
		let maxHexLength = 0;
		let maxBinLength = 0;
	
		vscode.window.showInformationMessage(`Formatting step 1/2...`);
		// Determining the maximum length of each part of each line to make the output well formatted
		for (let i = 0; i < code.length; i++) {
			const instruction = decodeInstruction(code[i])[0];
			const hex = binToHex(code[i]);
			const bin = hexToBin(hex).padStart(32, '0').replace(/(.{4})/g, '$1 ');
	
			maxInstructionLength = Math.max(maxInstructionLength, instruction.length);
			maxHexLength = Math.max(maxHexLength, hex.length);
			maxBinLength = Math.max(maxBinLength, bin.length);
		}
	
		vscode.window.showInformationMessage(`Formatting step 2/2...`);
		for (let i = 0; i < code.length; i++) {
			const instruction = decodeInstruction(code[i])[0];
			const hex = binToHex(code[i]);
			const bin = hexToBin(hex).padStart(32, '0').replace(/(.{4})/g, '$1 ');
	
			const paddedInstruction = instruction.padEnd(maxInstructionLength, ' ');
			const paddedHex = hex.padStart(maxHexLength, ' ');
			const paddedBin = bin.padStart(maxBinLength, ' ');
	
			content += `${paddedInstruction} ; ${paddedHex} | ${paddedBin} \n`;
		}

		const tempFile = await vscode.workspace.openTextDocument({ content: content, language: 'reti' });
        
        // Show the document in a new editor window
        await vscode.window.showTextDocument(tempFile);
	});

	const AssembleCommand = vscode.commands.registerCommand('reti.assemble', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {return;}

		const document = editor.document;
		if (document.languageId !== 'reti') {
			vscode.window.showErrorMessage("Unsupported file type. Please use .reti files.");
			return;
		}

		const code = parseDotReti(document);

		const assembler = ReTIConfig.isOS ? AsmOS : AsmTI;
		const mode = ReTIConfig.isOS ? "Extended ReTI (OS)" : "Basic ReTI (TI)";
		vscode.window.showInformationMessage(`Assembling using ${mode} assembler`);

		const assembled = await assembler.assembleFile(code);

		const formatted = assembled
			.map(([instruction]) => `${binToHex(instruction)}`)
			.join('\n');

		const tempFile = await vscode.workspace.openTextDocument({
			content: formatted,
			language: 'retias'
		});

		await vscode.window.showTextDocument(tempFile);
	});


	const DisassembleCommand = vscode.commands.registerCommand('reti.disassemble', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			if (document.languageId !== 'retias') {
				vscode.window.showErrorMessage("Unsupported file type. Please use .retias files.");
				return;
			}
			const instructions = parseDotRetiAs(document);

			let content = "; " + ReTIConfig.version + " \n";
			let maxInstructionLength = 0;
			let code: string[] = [];

			// Extra step needed for formatting. Determines the maximum length of any instruction.
			for (let i = 0; i < instructions.length; i++) {
				const instruction = disassembleWord(instructions[i]).instruction;
				maxInstructionLength = Math.max(maxInstructionLength, instruction.length);
				code.push(instruction);
			}

			for (let i = 0; i < code.length; i++) {
				const command = code[i];
				const paddedCommand = command.padEnd(maxInstructionLength, ' ');
				content += `${paddedCommand} ; ${binToHex(instructions[i])} \n`;
			}

			const tempFile = await vscode.workspace.openTextDocument({ content: content, language: 'reti' });
			await vscode.window.showTextDocument(tempFile);
		}
	});


	context.subscriptions.push(EmulateCommand, QuizCommand, RandomCommand, AssembleCommand, StopEmulationCommand, DisassembleCommand);

	switch (runMode) {
		case 'server':
			// run the debug adapter as a server inside the extension and communicate via a socket
			activateReTIDebug(context, new ReTIDebugAdapterServerDescriptorFactory());
			break;

		case 'namedPipeServer':
			// run the debug adapter as a server inside the extension and communicate via a named pipe (Windows) or UNIX domain socket (non-Windows)
			activateReTIDebug(context, new ReTIDebugAdapterNamedPipeServerDescriptorFactory());
			break;

		case 'external': default:
			// run the debug adapter as a separate process
			activateReTIDebug(context, new DebugAdapterExecutableFactory());
			break;

		case 'inline':
			// run the debug adapter inside the extension and directly talk to it
			activateReTIDebug(context);
			break;
	}
}

class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {

	// The following use of a DebugAdapter factory shows how to control what debug adapter executable is used.
	// Since the code implements the default behavior, it is absolutely not neccessary and we show it here only for educational purpose.

	createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
		// param "executable" contains the executable optionally specified in the package.json (if any)

		// use the executable specified in the package.json if it exists or determine it based on some other information (e.g. the session)
		if (!executable) {
			const command = "absolute path to my DA executable";
			const args = [
				"some args",
				"another arg"
			];
			const options = {
				cwd: "working directory for executable",
				env: { "envVariable": "some value" }
			};
			executable = new vscode.DebugAdapterExecutable(command, args, options);
		}

		// make VS Code launch the DA executable
		return executable;
	}
}

class ReTIDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

		if (!this.server) {
			// start listening on a random port
			this.server = Net.createServer(socket => {
				const session = new ReTIDebugSession(workspaceFileAccessor);
				session.setRunAsServer(true);
				session.start(socket as NodeJS.ReadableStream, socket);
			}).listen(0);
		}

		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer((this.server.address() as Net.AddressInfo).port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}

class ReTIDebugAdapterNamedPipeServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

		if (!this.server) {
			// start listening on a random named pipe path
			const pipeName = randomBytes(10).toString('utf8');
			const pipePath = platform === "win32" ? join('\\\\.\\pipe\\', pipeName) : join(tmpdir(), pipeName);

			this.server = Net.createServer(socket => {
				const session = new ReTIDebugSession(workspaceFileAccessor);
				session.setRunAsServer(true);
				session.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(pipePath);
		}

		// make VS Code connect to debug server
		return new vscode.DebugAdapterNamedPipeServer(this.server.address() as string);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Deactivate the language client
	if (!languageClient) {
		return undefined;
	}
	return languageClient.stop();
}
