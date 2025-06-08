/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { EventEmitter } from 'events';
import { Emulator } from '../reti/emulator';
import { assembleLine } from '../reti/assembler';
import { parseString } from '../util/parser';
import { registerCode } from '../reti/retiStructure';

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}

// TODO: Remove
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

export class MockRuntime extends EventEmitter {

	// the initial (and one and only) file we are 'debugging'


	private variables = new Map<string, RuntimeVariable>();

	// the contents (= lines) of the one and only file
	private sourceLines: string[] = [];

	// #region ReTI
	private _sourceFile: string = '';
	public get sourceFile() {
		return this._sourceFile;
	}

	private _sourceLines: string[] = [];
	private _instructions: string[][] = [];
	private _linesToInstructions: number[] = [];
	private _instrToLines: number[] = [];
	
	private _emulator: Emulator = new Emulator([], []);

	private _breakPoints = new Map<string, IRetiBreakpoint[]>;

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

	// Todo: Remove
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
	public async start(program: string, stopOnEntry: boolean, debug: boolean): Promise<boolean> {

		// Emulator is created here.
		if (await this.loadSource(this.normalizePathAndCasing(program))) {
			if (debug) {
				await this.verifyBreakpoints(this._sourceFile);

				if (stopOnEntry) {
					this.findNextStatement('stopOnEntry');
				} else {
					// we just start to run until we hit a breakpoint, an exception, or the end of the program
					this.continue();
				}
			} else {
				this.continue();
			}
			return true;
		} else {
			return false;
		}


	}

	/**
	 * Continue execution to the end/beginning.
	 */
	public continue() {

		while (!this.executeLine(this.currentLine)) {
			if (this.updateCurrentLine()) {
				break;
			}
			if (this.findNextStatement()) {
				break;
			}
		}
	}

	/**
	 * Step to the next/previous non empty line.
	 */
	public step(instruction: boolean) {

		if (instruction) {
			this.instruction++;
			this.sendEvent('stopOnStep');
		} else {
			if (!this.executeLine(this.currentLine)) {
				if (!this.updateCurrentLine()) {
					this.findNextStatement('stopOnStep');
				}
			}
		}
	}

	private updateCurrentLine(): boolean {
		// TODO: Make this use the reti pc length/ending instead
		if (this._emulator.isValidPC(this._linesToInstructions[this.currentLine])) {
			return false;
		} else {
			this.sendEvent('end');
			return true;
		}
	}

	/**
	 * "Step into" for Mock debug means: go to next character
	 */
	public stepIn(targetId: number | undefined) {
		if (typeof targetId === 'number') {
			this.currentColumn = targetId;
			this.sendEvent('stopOnStep');
		} else {
			if (typeof this.currentColumn === 'number') {
				if (this.currentColumn <= this.sourceLines[this.currentLine].length) {
					this.currentColumn += 1;
				}
			} else {
				this.currentColumn = 1;
			}
			this.sendEvent('stopOnStep');
		}
	}

	/**
	 * "Step out" for Mock debug means: go to previous character
	 */
	public stepOut() {
		if (typeof this.currentColumn === 'number') {
			this.currentColumn -= 1;
			if (this.currentColumn === 0) {
				this.currentColumn = undefined;
			}
		}
		this.sendEvent('stopOnStep');
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

	/**
	 * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
	 */
	public stack(startFrame: number, endFrame: number): IRuntimeStack {

		const line = this.getLine();
		const words = this.getWords(this.currentLine, line);
		words.push({ name: 'BOTTOM', line: -1, index: -1 });	// add a sentinel so that the stack is never empty...

		// if the line contains the word 'disassembly' we support to "disassemble" the line by adding an 'instruction' property to the stackframe
		const instruction = line.indexOf('disassembly') >= 0 ? this.instruction : undefined;

		const column = typeof this.currentColumn === 'number' ? this.currentColumn : undefined;

		const frames: IRuntimeStackFrame[] = [];
		// every word of the current line becomes a stack frame.
		for (let i = startFrame; i < Math.min(endFrame, words.length); i++) {

			const stackFrame: IRuntimeStackFrame = {
				index: i,
				name: `${words[i].name}(${i})`,	// use a word of the line as the stackframe name
				file: this._sourceFile,
				line: this.currentLine,
				column: column, // words[i].index
				instruction: instruction ? instruction + i : 0
			};

			frames.push(stackFrame);
		}

		return {
			frames: frames,
			count: words.length
		};
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
				this.currentLine = this._instrToLines[this._emulator.getRegister(registerCode.PC)];
				this.sendEvent('stopOnStep');
				break;
			default:
				return undefined;
		}
		return new RuntimeVariable(name, value);
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
		let ACC = new RuntimeVariable(
			"ACC", this._emulator.getRegister(registerCode.ACC));
		let IN1 = new RuntimeVariable(
			"IN1", this._emulator.getRegister(registerCode.IN1));
		let IN2 = new RuntimeVariable(
			"IN2", this._emulator.getRegister(registerCode.IN2));
		let PC = new RuntimeVariable(
			"PC", this._emulator.getRegister(registerCode.PC));
		return [ACC, IN1, IN2, PC];
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
		return this._sourceLines[line === undefined ? this.currentLine : line].trim();
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

	private async loadSource(file: string): Promise<boolean> {
		if (this._sourceFile !== file) {
			this._sourceFile = this.normalizePathAndCasing(file);
			return this.initializeContents(await this.fileAccessor.readFile(file));
		}
		return true;
	}

	private initializeContents(memory: Uint8Array): boolean {
		// TODO: Remove
		this.sourceLines = new TextDecoder().decode(memory).split(/\r?\n/);

		this.instructions = [];

		this.starts = [];
		this.instructions = [];
		this.ends = [];

		for (let l = 0; l < this.sourceLines.length; l++) {
			this.starts.push(this.instructions.length);
			const words = this.getWords(l, this.sourceLines[l]);
			for (let word of words) {
				this.instructions.push(word);
			}
			this.ends.push(this.instructions.length);
		}
		// ReTI
		this._instructions = parseString(new TextDecoder().decode(memory));
		this._sourceLines = new TextDecoder().decode(memory).split(/\r?\n/);

		let instructions: number[] = [];
		let num_instr = 0;
		for (let i = 0; i < this._sourceLines.length; i++) {
			// If its a comment only the line count is updated.
			if (this._sourceLines[i].startsWith(";")) {
				this._linesToInstructions.push(-1);
				continue;
			}
			let [err, instr, msg] = assembleLine(this._instructions[num_instr]);
			if (err !== -1) {
				instructions.push(instr);
				this._linesToInstructions.push(num_instr);
				this._instrToLines.push(i);
				num_instr++;
			}
			else {
				return false;
			}
		}
		// TODO: Add way to parse data or ReTI-State.
		this._emulator = new Emulator(instructions, []);
		return true;
	}

	/**
	 * return true on stop
	 */
	 private findNextStatement(stepEvent?: string): boolean {
		for (let ln = this.currentLine; ln < this._sourceLines.length; ln++) {

			const breakpoints = this.breakPoints.get(this._sourceFile);
			if (breakpoints) {
				const bps = breakpoints.filter(bp => bp.line === ln);
				if (bps.length > 0) {

					// send 'stopped' event
					this.sendEvent('stopOnBreakpoint');

					// the following shows the use of 'breakpoint' events to update properties of a breakpoint in the UI
					// if breakpoint is not yet verified, verify it now and send a 'breakpoint' update event
					if (!bps[0].verified) {
						bps[0].verified = true;
						this.sendEvent('breakpointValidated', bps[0]);
					}

					this.currentLine = ln;
					return true;
				}
			}

			const line = this.getLine(ln);
			if (line.length > 0) {
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
		// TODO:
		// 1. Map  line to corresponding instruction in emulator.
		let instr_number = this._linesToInstructions[ln];
		// If it is -1 the line is a comment.
		if (instr_number === -1) { return false; }
		// 2. Execute said line
		let err_code = this._emulator.step();
		if (err_code === 1) {
			return true;
		}
		let new_pc = this._emulator.getRegister(registerCode.PC);

		if (instr_number > this._instrToLines.length - 1) {
			return true;
		}
		this.currentLine = this._instrToLines[new_pc];
		// nothing interesting found -> continue
		return false;
	}

	private async verifyBreakpoints(path: string): Promise<void> {

		const bps = this.breakPoints.get(path);
		if (bps) {
			await this.loadSource(path);
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
		}

		// Todo: Add ReTI logic
		const breakpoints = this._breakPoints.get(path);
		if (breakpoints) {
			await this.loadSource(path);
			breakpoints.forEach(bp => {
				if (!bp.verified && bp.line < this.sourceLines.length) {
					const srcLine = this.getLine(bp.line);

					// if a line is empty or starts with ';' we don't allow to set a breakpoint but move the breakpoint down
					if (srcLine.length === 0 || srcLine.indexOf(';') === 0) {
						bp.line++;
					}
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
}
