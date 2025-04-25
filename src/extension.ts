// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { Emulator } from './reti/emulator';
import { parseDotReti, parseDotRetiAs } from './util/parser';
import { showQuizPanel } from './ui/quizPanel';
import { randomInstruction, randomReti } from './util/randomReti';
import { decodeInstruction } from './reti/disassembler';
import { binToHex, hexToBin } from './util/retiUtility';
import { assembleFile, assembleLine } from './reti/assembler';
import { stateToString } from './reti/retiStructure';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';


let languageClient: LanguageClient | undefined = undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {	

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
				outputChannel.show();
				vscode.window.showInformationMessage(`Emulation finished. Final state: ${stateToString(finalState)}`);
			}
			catch (e) {
				vscode.window.showErrorMessage(`Error when emulating: ${e}`);
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

	// TODO: Move into a seperate function
	const RandomCommand = vscode.commands.registerCommand('reti.generate', async () => {
		const val = await vscode.window.showInputBox({ prompt: "Enter desired length of random code (Max 4096). If left empty, a random length will be chosen." });

		let code : number[] = [];
		if (val === undefined) {
			return;
		}
		else if (val === "") {
			code = randomReti(null);
		}
		else {
			let value = parseInt(val);

			if (value < 0) { value = 0; }
			if (value > 4096) { value = 4096; }
			vscode.window.showInformationMessage(`Generating ${value} random instructions...`);
			for (let i = 0; i < value; i++) {
				code.push(randomInstruction());
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
		if (editor) {
			const document = editor.document;
			let code = [];
		
			if (document.languageId === 'reti') {
				code = parseDotReti(document);
			}
			else {
				vscode.window.showErrorMessage("Unsupported file type. Please use .reti files.");
				return;
			}

			const assembled = await assembleFile(code);
			const formatted = assembled.map(([instruction, message]) => `${binToHex(instruction)} ; ${message}`).join('\n');
			const tempFile = await vscode.workspace.openTextDocument({ content: formatted, language: 'retias' });
			await vscode.window.showTextDocument(tempFile);
		}
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

			let content = "";
			let maxInstructionLength = 0;
			let code: string[] = [];

			// Extra step needed for formatting. Determines the maximum length of any instruction.
			for (let i = 0; i < instructions.length; i++) {
				const instruction = decodeInstruction(instructions[i])[0];
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

	const DebugCommand = vscode.commands.registerCommand('reti.debug', async(resource: vscode.Uri) => {
		vscode.debug.startDebugging( undefined, {
			type: 'reti-debug',
			name: "Debug ReTI",
			request: "launch",
			program: resource.fsPath,
			stopOnEntry: true
		});
	});

	context.subscriptions.push(EmulateCommand, QuizCommand, RandomCommand, AssembleCommand, StopEmulationCommand, DisassembleCommand, DebugCommand);
}


// This method is called when your extension is deactivated
export function deactivate() {
	// Deactivate the language client
	if (!languageClient) {
		return undefined;
	}
	return languageClient.stop();
}
