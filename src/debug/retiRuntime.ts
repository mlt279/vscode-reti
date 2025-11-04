/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { EventEmitter } from 'events';
import { assembleLine } from '../reti//assembler';
import { parseString } from '../util/parser';
import { registerCode } from '../reti/ti/retiStructure_ti';
import { CancellationToken } from 'vscode';
import { generateBitMask, immediateAsTwoc } from '../util/retiUtility';
import { IEmulator, createEmulator } from '../reti/emulator';
import { EmulatorOS, osRegisterCode } from '../reti/os/emulator_os';
import { Emulator } from '../reti/ti/emulator_ti';

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}

export interface IRuntimeBreakpoint {
	id: number;
	line: number;
	verified: boolean;
}
export interface IRetiBreakpoint {
    id: number;
	line: number;
	verified: boolean;
    instruction: number;
}

// #region not needed
interface IRuntimeStepInTargets {
	id: number;
	label: string;
}

interface IRuntimeStackFrame {
	index: number;
	name: string;
	file: string;
	line: number;
	column?: number;
	instruction?: number;
}

interface IRuntimeStack {
	count: number;
	frames: IRuntimeStackFrame[];
}

interface RuntimeDisassembledInstruction {
	address: number;
	instruction: string;
	line?: number;
}
// TODO: Clean up
export type IRuntimeVariableType = number | boolean | string | RuntimeVariable[];

export class RuntimeVariable {
	private _memory?: Uint8Array;

	public reference?: number;

	public get value() {
		return this._value;
	}

	public set value(value: IRuntimeVariableType) {
		this._value = value;
		this._memory = undefined;
	}

	public get memory() {
		if (this._memory === undefined && typeof this._value === 'string') {
			this._memory = new TextEncoder().encode(this._value);
		}
		return this._memory;
	}

	constructor(public readonly name: string, private _value: IRuntimeVariableType) {}

	public setMemory(data: Uint8Array, offset = 0) {
		const memory = this.memory;
		if (!memory) {
			return;
		}

		memory.set(data, offset);
		this._memory = memory;
		this._value = new TextDecoder().decode(memory);
	}
}

interface Word {
	name: string;
	line: number;
	index: number;
}

// #endregion

export function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export class ReTIRuntime extends EventEmitter {

	// #region needed for interupts
	public _isrFile: string | undefined;

	private _sourceLinesISR: string[] = [];
	private _instrToLinesMain: number[] = []; // existing: _instrToLines (keep as “main”)
	private _instrToLinesISR: number[] = [];
	
	private _instructionsISR: string[][] = [];
	private _linesToInstructionsISR: number[] = [];

	private _mainInstrs: number[] = [];
	private _isrInstrs: number[] = [];

	// #endregion

	private cancellationToken: CancellationToken | undefined;

	// the contents (= lines) of the one and only file
	private sourceLines: string[] = [];

	// #region ReTI
	public _sourceFile: string = '';
	public get sourceFile() {
		return this._sourceFile;
	}

	private _sourceLines: string[] = [];
	private _instructions: string[][] = [];
	private _linesToInstructions: number[] = [];
	private _instrToLines: number[] = [];
	
	private _emulator: IEmulator = createEmulator([], []);

	private _breakPoints = new Map<string, IRetiBreakpoint[]>;
	private _returnStack: number[] = [];

	// This is the next line that will be 'executed'
	private _currentLine = 0;
	private get currentLine() {
		return this._currentLine;
	}
	private set currentLine(x) {
		this._currentLine = x;
		this.instruction = this.starts[x];
	}

	private _breakPointsID = 1;
	// #endregion

	private instructions: Word[] = [];
	private starts: number[] = [];
	private ends: number[] = [];


	private currentColumn: number | undefined;

	// This is the next instruction that will be 'executed'
	public instruction= 0;

	// maps from sourceFile to array of IRuntimeBreakpoint
	private breakPoints = new Map<string, IRuntimeBreakpoint[]>();

	// all instruction breakpoint addresses
	private instructionBreakpoints = new Set<number>();

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private breakpointId = 1;

	private breakAddresses = new Map<string, string>();

	private namedException: string | undefined;
	private otherExceptions = false;


	constructor(private fileAccessor: FileAccessor) {
		super();
	}

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, debug: boolean, cancellationToken: CancellationToken, isrprogram?: string): Promise<boolean> {

		if (isrprogram) { isrprogram = this.normalizePathAndCasing(isrprogram)}
		if (!await this.loadSource(this.normalizePathAndCasing(program), isrprogram)) {return false;}
		// Emulator is created here.
			if (debug) {
				await this.verifyBreakpoints(this._sourceFile);
				if (isrprogram) {
					await this.verifyBreakpoints(isrprogram);
				}
				if (stopOnEntry) {
					this.findNextStatement('stopOnEntry');
				} else {
					// we just start to run until we hit a breakpoint, an exception, or the end of the program
					this.continue(cancellationToken);
				}
			} else {
				this.continue(cancellationToken);
			}
			return true;
	}

	/**
	 * Continue execution to the end/beginning.
	 */
	public async continue(cancellationToken: CancellationToken): Promise<void> {
		while (!this.executeLine(this.currentLine)) {
			if (cancellationToken.isCancellationRequested) {
				this.sendEvent('stopOnPause');
				break;
			}
			// Needed to allow other events to be processed.
			await new Promise((resolve) => setImmediate(resolve, 0));
			if (this.findNextStatement()) {
				break;
			}
		}
	}

	/**
	 * "Step into" means step to the next instruction.
	 */
	public stepIn() {
		if (!this.executeLine(this.currentLine)) {
			this.findNextStatement('stopOnStepIn');
		}		
	}
	/**
	 * "Step over" for ReTI means: If PC is the address of the JUMP instruction
	 * execute code until PC + 1 is reached.
	 */
	public async stepOver(cancellationToken: CancellationToken) {
		let [isCallInstruction, target_pc] = this._emulator.isCallInstruction();
		
		if (isCallInstruction) {
			while (true) {
				if (cancellationToken.isCancellationRequested) {
					this.sendEvent('stopOnPause');
					break;
				}
				// Needed to allow other events to be processed.
				await new Promise((resolve) => setImmediate(resolve, 0));

				if (this.executeLine(this.currentLine)) {
					break;
				}
				let instrNum = this._emulator.inIsr?this._linesToInstructionsISR[this.currentLine]:this._linesToInstructions[this.currentLine];
				let pc = this.instrNumToPC(instrNum);
				if (!this._emulator.isValidPC(pc)) {
					this.sendEvent('end');
					break;
				}
				if (this.findNextStatement()) {
					break;
				}
				let nextPc = this._emulator.getRegister(registerCode.PC);
				if (nextPc === target_pc) {
					this.sendEvent('stopOnStepOver');
					break;
				}
			}
		} else {
			if (!this.executeLine(this.currentLine)) {
				this.findNextStatement('stopOnStepOver');
			}		
		}
	}

	private getTargetPC(): number {
		let instruction = this._emulator.getCurrentInstruction();

		let line = this.getLine().toLowerCase().split(' ');
		if (line[0].startsWith('jump')) {
			let immediate = immediateAsTwoc(instruction & generateBitMask(24));
			let pc = this._emulator.getRegister(registerCode.PC);
			let target_pc = pc + immediate;
			immediate = immediate;
			return target_pc;
					
		}
		if (line[0].startsWith('move') && line.length > 2) {
			if (line[2] === 'pc') {
				let source = line[1];
				switch (source.toLocaleLowerCase()) {
					case "acc":
						return this._emulator.getRegister(registerCode.ACC);
					case "in1":
						return this._emulator.getRegister(registerCode.IN1);
					case "in2":
						return this._emulator.getRegister(registerCode.IN2);
					case "pc":
						return this._emulator.getRegister(registerCode.PC);	
				}
			}
		}
		return this._emulator.getRegister(registerCode.PC) + 1;
	}

	/**
	 * "Step out" for Mock debug means: 
	 * 1. If the stack is empty behaves like normal "continue"
	 * 2. If the stack is not empty, we continue until the PC saved in
	 *   the return stack is reached.
	 */
	public async stepOut(cancellationToken: CancellationToken) {
		// If the return stack is empty there will be no JUMP waiting. Step Out
		// executes the "main" program.
		// So we just continue.
		if (this._returnStack.length === 0) {
			this.continue(cancellationToken);
			return;
		}

		let returnPc = this._returnStack[this._returnStack.length - 1];
		
		while (true) {
			if (cancellationToken.isCancellationRequested) {
				this.sendEvent('stopOnPause');
				break;
			}
			// Needed to allow other events to be processed.
			await new Promise((resolve) => setImmediate(resolve, 0));
			const linesToInstructions = this._emulator.inIsr?this._linesToInstructionsISR:this._linesToInstructions;
			if (this.instrNumToPC(linesToInstructions[this.currentLine]) === returnPc) {
				this.sendEvent('stopOnStepOut');
				this._returnStack.pop();
				break;
			}
			if (this.executeLine(this.currentLine)) {
				break;
			}
			if (this.findNextStatement()) {
				break;
			}
		}
	}

	public getStepInTargets(frameId: number): IRuntimeStepInTargets[] {

		const line = this.getLine();
		const words = this.getWords(this.currentLine, line);

		// return nothing if frameId is out of range
		if (frameId < 0 || frameId >= words.length) {
			return [];
		}

		const { name, index  }  = words[frameId];

		// make every character of the frame a potential "step in" target
		return name.split('').map((c, ix) => {
			return {
				id: index + ix,
				label: `target: ${c}`
			};
		});
	}

	public getMemoryChunk(start: number, count: number): number[] {
		let memory = [];
		for (let i = 0; i < count; i++) {
			memory.push(this._emulator.getData(start + i));
		}
		return memory;
	}

	public setData(address: number, data: number) {
		this._emulator.setData(address, data);
	}

	public getData(address: number): number {
		return this._emulator.getData(address);
	}

	public stack(startFrame: number, endFrame: number) {
	const { file, line } = this.getSourceForPC();

	const frames = [{
		index: 0,
		name: 'ReTI',
		file,
		line,
		column: 0,
		instruction: this.instruction
	}];

	return { frames, count: 1 };
	}

	public setRegister(name: string, value: number): RuntimeVariable | undefined {
		switch (name.toLowerCase()) {
			case 'acc':
				this._emulator.setRegister(registerCode.ACC, value);
				break;
			case 'in1':
				this._emulator.setRegister(registerCode.IN1, value);
				break;
			case 'in2':
				this._emulator.setRegister(registerCode.IN2, value);
				break;
			case 'pc':
				this._emulator.setRegister(registerCode.PC, value);
				this.currentLine = this._instrToLines[this.getInstrNum()];
				this.sendEvent('stopOnStep');
				break;
			default:
				return undefined;
		}
		return new RuntimeVariable(name, value);
	}

	public getInstrNum(): number {
		if (this._emulator instanceof EmulatorOS) {
			let instr = this._emulator.getRegister(osRegisterCode.PC);
			instr -= this._emulator.getRegister(osRegisterCode.CS);
			if (this._emulator.inIsr) { instr += this._instrToLinesISR.length}
			return instr;
		 }
		 else {
			return this._emulator.getRegister(registerCode.PC);
		 }
	}

	public instrNumToPC(instr: number): number{
		if (this._emulator instanceof EmulatorOS) {
			let pc = this._emulator.getRegister(osRegisterCode.CS) + instr
			if (this._emulator.inIsr) { pc += this._instrToLinesISR.length}
			return pc;
		}
		else {
			return instr;
		}
	}

	public evaluate(expression: string): RuntimeVariable | undefined {
		expression = expression.toLowerCase();
		let value = 0;
		switch (expression) {
			case 'acc':
				value = this._emulator.getRegister(registerCode.ACC);
				break;
			case 'in1':
				value = this._emulator.getRegister(registerCode.IN1);
				break;
			case 'in2':
				value = this._emulator.getRegister(registerCode.IN2);
				break;
			case 'pc':
				value = this._emulator.getRegister(registerCode.PC);
				break;
			default:
				if (expression.startsWith('0x')) {
					try {
						let address = parseInt(expression, 16);
						if (Number.isNaN(address)) {
							return undefined;
						}
						value = this._emulator.getData(address);
					} catch(e) {
						return undefined;
					}
				} else {
					try {
						let address = parseInt(expression, 10);
						if (Number.isNaN(address)) {
							return undefined;
						}
						value = this._emulator.getData(address);
					} catch(e) {
						return undefined;
					}
				}
		}
		return new RuntimeVariable(expression, value);
	}

	/*
	 * Determine possible column breakpoint positions for the given line.
	 * Here we return the start location of words with more than 8 characters.
	 */
	public getBreakpoints(path: string, line: number): number[] {
		return this.getWords(line, this.getLine(line)).filter(w => w.name.length > 8).map(w => w.index);
	}

	/*
	 * Set breakpoint in file with given line.
	 */
	public async setBreakPoint(path: string, line: number): Promise<IRuntimeBreakpoint> {
		path = this.normalizePathAndCasing(path);

		const bp: IRuntimeBreakpoint = { verified: false, line, id: this.breakpointId++ };
		let bps = this.breakPoints.get(path);
		if (!bps) {
			bps = new Array<IRuntimeBreakpoint>();
			this.breakPoints.set(path, bps);
		}
		bps.push(bp);

		await this.verifyBreakpoints(path);

		return bp;
	}

	/*
	 * Clear breakpoint in file with given line.
	 */
	public clearBreakPoint(path: string, line: number): IRuntimeBreakpoint | undefined {
		const bps = this.breakPoints.get(this.normalizePathAndCasing(path));
		if (bps) {
			const index = bps.findIndex(bp => bp.line === line);
			if (index >= 0) {
				const bp = bps[index];
				bps.splice(index, 1);
				return bp;
			}
		}
		return undefined;
	}

	public clearBreakpoints(path: string): void {
		this.breakPoints.delete(this.normalizePathAndCasing(path));
	}

	public setDataBreakpoint(address: string, accessType: 'read' | 'write' | 'readWrite'): boolean {

		const x = accessType === 'readWrite' ? 'read write' : accessType;

		const t = this.breakAddresses.get(address);
		if (t) {
			if (t !== x) {
				this.breakAddresses.set(address, 'read write');
			}
		} else {
			this.breakAddresses.set(address, x);
		}
		return true;
	}

	public clearAllDataBreakpoints(): void {
		this.breakAddresses.clear();
	}

	public setExceptionsFilters(namedException: string | undefined, otherExceptions: boolean): void {
		this.namedException = namedException;
		this.otherExceptions = otherExceptions;
	}

	public setInstructionBreakpoint(address: number): boolean {
		this.instructionBreakpoints.add(address);
		return true;
	}

	public clearInstructionBreakpoints(): void {
		this.instructionBreakpoints.clear();
	}

	public async getGlobalVariables(cancellationToken?: () => boolean ): Promise<RuntimeVariable[]> {

		let a: RuntimeVariable[] = [];

		for (let i = 0; i < 10; i++) {
			a.push(new RuntimeVariable(`global_${i}`, i));
			if (cancellationToken && cancellationToken()) {
				break;
			}
			await timeout(1000);
		}

		return a;
	}

	public getLocalVariables(): RuntimeVariable[] {
		let vars = [];
		for (const register_name in this._emulator.getRegisterCodes())  {
			const registerCode = this._emulator.getRegisterCodes()[register_name];
			vars.push(new RuntimeVariable(
						register_name, this._emulator.getRegister(registerCode)));
		}
		// let ACC = new RuntimeVariable(
		// 	"ACC", this._emulator.getRegister(registerCode.ACC));
		// let IN1 = new RuntimeVariable(
		// 	"IN1", this._emulator.getRegister(registerCode.IN1));
		// let IN2 = new RuntimeVariable(
		// 	"IN2", this._emulator.getRegister(registerCode.IN2));
		// let PC = new RuntimeVariable(
		// 	"PC", this._emulator.getRegister(registerCode.PC));
		return vars;
	}

	public setLocalVariables(name: string, value: number): RuntimeVariable | undefined {
		switch (name.toLowerCase()) {
			case "acc":
				this._emulator.setRegister(registerCode.ACC, value);
				break;
			case "in1":
				this._emulator.setRegister(registerCode.IN1, value);
				break;
			case "in2":
				this._emulator.setRegister(registerCode.IN2, value);
				break;
			case "pc":
				this._emulator.setRegister(registerCode.PC, value);
				break;
			default:
				return undefined;
		}
	}

	/**
	 * Return words of the given address range as "instructions"
	 */
	public disassemble(address: number, instructionCount: number): RuntimeDisassembledInstruction[] {

		const instructions: RuntimeDisassembledInstruction[] = [];

		for (let a = address; a < address + instructionCount; a++) {
			if (a >= 0 && a < this.instructions.length) {
				instructions.push({
					address: a,
					instruction: this.instructions[a].name,
					line: this.instructions[a].line
				});
			} else {
				instructions.push({
					address: a,
					instruction: 'nop'
				});
			}
		}

		return instructions;
	}

	// private methods

	private getLine(line?: number): string {
		const sourceLines = this._emulator.inIsr ? this._sourceLinesISR : this._sourceLines;
		return sourceLines[line === undefined ? this.currentLine : line].trim();
	}

	private getWords(l: number, line: string): Word[] {
		// break line into words
		const WORD_REGEXP = /[a-z]+/ig;
		const words: Word[] = [];
		let match: RegExpExecArray | null;
		while (match = WORD_REGEXP.exec(line)) {
			words.push({ name: match[0], line: l, index: match.index });
		}
		return words;
	}

	private async loadSource(file: string, isrFile?: string): Promise<boolean> {
		if (this._sourceFile !== file || isrFile !== this._isrFile) {
			this._sourceFile = this.normalizePathAndCasing(file);
			if (isrFile) {
				this._isrFile = this.normalizePathAndCasing(isrFile);
				return this.initializeContents(await this.fileAccessor.readFile(file), await this.fileAccessor.readFile(isrFile));
			} else {
				this._isrFile = undefined;
				return this.initializeContents(await this.fileAccessor.readFile(file));
			}
		}
		return true;
	}

	private initializeContents(memory: Uint8Array, isr?: Uint8Array): boolean {
		// Load Main Program
		this._instructions = parseString(new TextDecoder().decode(memory));
		this._sourceLines = new TextDecoder().decode(memory).split(/\r?\n/);
		if (this._linesToInstructions.length > 0) {
			this._linesToInstructions = [];
		}
		if (this._instrToLines.length > 0) {
			this._instrToLines = [];
		}

		let instructions: number[] = [];
		let num_instr = 0;
		for (let i = 0; i < this._sourceLines.length; i++) {
			// If its a comment only the line count is updated.
			if (this._sourceLines[i].trim().startsWith(";") || this._sourceLines[i].length === 0) {
				this._linesToInstructions.push(-1);
				continue;
			}
			let [err, instr, msg] = assembleLine(this._instructions[num_instr]);
			if (err !== -1) {
				instructions.push(instr);
				this._linesToInstructions.push(num_instr);
				// i is the current line.
				this._instrToLines.push(i);
				num_instr++;
			}
			else {
				return false;
			}
		}

		let instructionsISR: number[] = [];
		let num_instrISR = 0;
		if (isr) {	// LOAD ISR
			this._instructionsISR = parseString(new TextDecoder().decode(isr));
			this._sourceLinesISR = new TextDecoder().decode(isr).split(/\r?\n/);
			if (this._linesToInstructionsISR.length > 0) {
				this._linesToInstructionsISR = [];
			}
			if (this._instrToLinesISR.length > 0) {
				this._instrToLinesISR = [];
			}

			for (let i = 0; i < this._sourceLinesISR.length; i++) {
				// If its a comment only the line count is updated.
				if (this._sourceLinesISR[i].trim().startsWith(";") || this._sourceLinesISR[i].length === 0) {
					this._linesToInstructionsISR.push(-1);
					continue;
				}
				let [err, instr, msg] = assembleLine(this._instructionsISR[num_instrISR]);
				if (err !== -1) {
					instructionsISR.push(instr);
					this._linesToInstructionsISR.push(num_instrISR);
					// i is the current line.
					this._instrToLinesISR.push(i);
					num_instrISR++;
				}
				else {
					return false;
				}
			}}
		this._emulator = createEmulator(instructions, instructionsISR);
		return true;
	}

	/**
	 * return true on stop
	 */
	 private findNextStatement(stepEvent?: string): boolean {
		let file = this.getSourceForPC().file;
		let breakpoints = this.breakPoints.get(file);
		const source_lineLength = (file === this._isrFile)? this._sourceLinesISR.length:this._sourceLines.length;
		for (let ln = this.currentLine; ln < source_lineLength; ln++) {
		    file = this.getSourceForPC().file;
			breakpoints = this.breakPoints.get(file);
			if (breakpoints) {
				const bps = breakpoints.filter(bp => bp.line === ln);
				if (bps.length > 0) {

					// send 'stopped' event
					this.sendEvent('stopOnBreakpoint');
					if (!bps[0].verified) {
						bps[0].verified = true;
						this.sendEvent('breakpointValidated', bps[0]);
					}

					this.currentLine = ln;
					return true;
				}
			}

			const line = this.getLine(ln);
			if (line.length > 0 && line.indexOf(';') !== 0) {
				this.currentLine = ln;
				break;
			}
		}
		if (stepEvent) {
			this.sendEvent(stepEvent);
			return true;
		}
		return false;
	}

	/**
	 * "execute a line" of the ReTI Code.
	 * Returns true if execution sent out a stopped event and needs to stop.
	 */
	private executeLine(ln: number): boolean {
		// 1. Map  line to corresponding instruction in emulator.
		let file = this.getSourceForPC().file;
		let lineMap = (file === this._isrFile) ? this._linesToInstructionsISR : this._linesToInstructions;
		let instrMap = (file === this._isrFile) ? this._instrToLinesISR : this._instrToLines;
		let instr_number = lineMap[ln];
		// If it is -1 the line is a comment.
		if (instr_number === -1) { return false; }


		// Save for Check if it is a call instruction to push on the return stack.
		let [is_callInstruction, target_pc] = this._emulator.isCallInstruction();

		// 2. Execute said line
		let err_code = this._emulator.step();
		if (err_code === 1) {
			return true;
		}

		
		file = this.getSourceForPC().file;
		lineMap = (file === this._isrFile) ? this._linesToInstructionsISR : this._linesToInstructions;
		instrMap = (file === this._isrFile) ? this._instrToLinesISR : this._instrToLines;

		let new_pc = this._emulator.getRegister(registerCode.PC);
		let instrNum = this.getInstrNum();
		// If it is a jump instruction and the new PC is on the return
		// stack the jump call would just be a step out.
		if (is_callInstruction && this._returnStack[this._returnStack.length - 1] !== new_pc) {
			// Only push if the new PC is not already on the return stack as the JUMP calls may be called
			// multiple times.
			if (this._returnStack[this._returnStack.length - 1] !== target_pc) {
				this._returnStack.push(target_pc);
			}
		}
		if (instrNum > instrMap.length - 1) {
			return true;
		}
		this.currentLine = instrMap[instrNum];
		if (this.currentLine === undefined || !this._emulator.isValidPC(lineMap[this.currentLine])) {
			this.sendEvent('end');
			return true;
		}
		// nothing interesting found -> continue
		return false;
	}

	private async verifyBreakpoints(path: string): Promise<void> {
		const bps = this.breakPoints.get(path);
		if (!bps) {return;}
		if (path === this._sourceFile){			
			// await this.loadSource(path);
			bps.forEach(bp => {
				if (!bp.verified && bp.line < this.sourceLines.length) {
					const srcLine = this.getLine(bp.line);

					// if a line is empty or starts with ';' we don't allow to set a breakpoint but move the breakpoint down
					if (srcLine.length === 0 || srcLine.indexOf(';') === 0) {
						bp.line++;
					}
					// don't set 'verified' to true if the line contains the word 'lazy'
					// in this case the breakpoint will be verified 'lazy' after hitting it once.
					if (srcLine.indexOf('lazy') / 0 < 0) {
						bp.verified = true;
						this.sendEvent('breakpointValidated', bp);
					}
				}
			});
		} else if (path === this._isrFile) {
			// await this.loadSource(this._sourceFile, this._isrFile);
			bps.forEach(bp => {
				if (!bp.verified && bp.line < this._sourceLinesISR.length) {
					const srcLine = this._sourceLinesISR[bp.line];
					if (srcLine.length === 0 || srcLine.startsWith(';')) bp.line++;
					bp.verified = true;
					this.sendEvent('breakpointValidated', bp);
				}
			});
		}
	}

	private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

	private normalizePathAndCasing(path: string) {
		if (this.fileAccessor.isWindows) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}

	// #region needed for interrupts
	public setISRFile(path: string) {
	this._isrFile = this.normalizePathAndCasing(path);
	}

	public getSourceForPC(): { file: string; line: number } {
	const pc = this._emulator.getRegister(registerCode.PC);

	if (this._emulator instanceof EmulatorOS) {
		const relativePC = this.getInstrNum();

		if (this._emulator.inIsr) {
		// inside ISR
		let instrIndex = relativePC;
		let line = this._instrToLinesISR[instrIndex] ?? 0;
		return { file: this._isrFile ?? this._sourceFile, line };
		} else {
		// inside main ReTI program
		const mainIndex = relativePC;
		const line = this._instrToLines[mainIndex] ?? 0;
		return { file: this._sourceFile, line };
		}
	}

	// For TI only return the source file.
	const instrIndex = this.getInstrNum();
	const line = this._instrToLines[instrIndex] ?? 0;
	return { file: this._sourceFile, line };
	}
	// #endregion
}
