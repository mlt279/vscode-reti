// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Emulator } from './reti/emulator';
import { parse } from './util/parser';
import { showQuizPanel } from './ui/quizPanel';
import { randomInstruction, randomReti } from './util/randomReti';
import { decodeInstruction } from './reti/disassembler';
import { binToHex, hexToBin } from './util/retiUtility';
import { assembleFile, assembleLine } from './reti/assembler';
import { stateToString } from './reti/retiStructure';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let emulateTokenSource : vscode.CancellationTokenSource | undefined = undefined;

	const EmulateCommand = vscode.commands.registerCommand('reti.emulate', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const code = parse(editor.document);
			if (code.length === 0) {
				vscode.window.showErrorMessage("No code to emulate.");
				return;
			}
			const assembled: number[] = [];
			for (let line of code) {
				const [errcode, instruction, message] = assembleLine(line);
				if (errcode !== 0) {
					vscode.window.showErrorMessage(`Error when assembling: ${instruction} | ${message}`);
					return;
				}
				assembled.push(instruction);
			}
			emulateTokenSource = new vscode.CancellationTokenSource();
			const outputChannel = vscode.window.createOutputChannel("ReTI Emulator");
			let emulator = new Emulator(assembled, [], outputChannel);
			try {
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
			// emulateTokenSource.dispose();
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
			const code = parse(editor.document);
			const assembled = await assembleFile(code);
			const formatted = assembled.map(([instruction, message]) => `${instruction} ; ${message}`).join('\n');
			const tempFile = await vscode.workspace.openTextDocument({ content: formatted, language: 'retias' });
			await vscode.window.showTextDocument(tempFile);
		}
	});

	context.subscriptions.push(EmulateCommand, QuizCommand, RandomCommand, AssembleCommand, StopEmulationCommand);
}


// This method is called when your extension is deactivated
export function deactivate() {}
