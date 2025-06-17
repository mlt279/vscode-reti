/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { EventEmitter } from 'events';
import { Emulator } from '../reti/emulator';
import { assembleLine } from '../reti/assembler';
import { parseString } from '../util/parser';
import { registerCode } from '../reti/retiStructure';
export class RuntimeVariable {
    name;
    _value;
    _memory;
    reference;
    get value() {
        return this._value;
    }
    set value(value) {
        this._value = value;
        this._memory = undefined;
    }
    get memory() {
        if (this._memory === undefined && typeof this._value === 'string') {
            this._memory = new TextEncoder().encode(this._value);
        }
        return this._memory;
    }
    constructor(name, _value) {
        this.name = name;
        this._value = _value;
    }
    setMemory(data, offset = 0) {
        const memory = this.memory;
        if (!memory) {
            return;
        }
        memory.set(data, offset);
        this._memory = memory;
        this._value = new TextDecoder().decode(memory);
    }
}
// #endregion
export function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export class ReTIRuntime extends EventEmitter {
    fileAccessor;
    // the initial (and one and only) file we are 'debugging'
    variables = new Map();
    // the contents (= lines) of the one and only file
    sourceLines = [];
    // #region ReTI
    _sourceFile = '';
    get sourceFile() {
        return this._sourceFile;
    }
    _sourceLines = [];
    _instructions = [];
    _linesToInstructions = [];
    _instrToLines = [];
    _emulator = new Emulator([], []);
    _breakPoints = new Map;
    _returnStack = [];
    // This is the next line that will be 'executed'
    _currentLine = 0;
    get currentLine() {
        return this._currentLine;
    }
    set currentLine(x) {
        this._currentLine = x;
        this.instruction = this.starts[x];
    }
    _breakPointsID = 1;
    // #endregion
    // Todo: Remove
    instructions = [];
    starts = [];
    ends = [];
    currentColumn;
    // This is the next instruction that will be 'executed'
    instruction = 0;
    // maps from sourceFile to array of IRuntimeBreakpoint
    breakPoints = new Map();
    // all instruction breakpoint addresses
    instructionBreakpoints = new Set();
    // since we want to send breakpoint events, we will assign an id to every event
    // so that the frontend can match events with breakpoints.
    breakpointId = 1;
    breakAddresses = new Map();
    namedException;
    otherExceptions = false;
    constructor(fileAccessor) {
        super();
        this.fileAccessor = fileAccessor;
    }
    /**
     * Start executing the given program.
     */
    async start(program, stopOnEntry, debug) {
        // Emulator is created here.
        if (await this.loadSource(this.normalizePathAndCasing(program))) {
            if (debug) {
                await this.verifyBreakpoints(this._sourceFile);
                if (stopOnEntry) {
                    this.findNextStatement('stopOnEntry');
                }
                else {
                    // we just start to run until we hit a breakpoint, an exception, or the end of the program
                    this.continue();
                }
            }
            else {
                this.continue();
            }
            return true;
        }
        else {
            return false;
        }
    }
    updateCurrentLine() {
        if (this._emulator.isValidPC(this._linesToInstructions[this.currentLine])) {
            return false;
        }
        else {
            this.sendEvent('end');
            return true;
        }
    }
    /**
     * Continue execution to the end/beginning.
     */
    continue() {
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
     * "Step into" means step to the next instruction.
     */
    stepIn() {
        if (!this.executeLine(this.currentLine)) {
            if (!this.updateCurrentLine()) {
                this.findNextStatement('stopOnStepIn');
            }
        }
    }
    /**
     * "Step over" for ReTI means: If PC is the address of the JUMP instruction
     * execute code until PC + 1 is reached.
     */
    stepOver() {
        if (this.isJumpInstruction()) {
            let pc = this._emulator.getRegister(registerCode.PC);
            while (true) {
                if (this.executeLine(this.currentLine)) {
                    break;
                }
                if (this.updateCurrentLine()) {
                    break;
                }
                if (this.findNextStatement()) {
                    break;
                }
                let nextPc = this._emulator.getRegister(registerCode.PC);
                if (nextPc === pc + 1) {
                    this.sendEvent('stopOnStepOver');
                    break;
                }
            }
        }
        else {
            if (!this.executeLine(this.currentLine)) {
                if (!this.updateCurrentLine()) {
                    this.findNextStatement('stopOnStepOver');
                }
            }
        }
    }
    isJumpInstruction() {
        let line = this.getLine().toLowerCase().split(' ');
        if (line[0].startsWith('jump')) {
            return true;
        }
        if (line[0].startsWith('move') && line.length > 2) {
            if (line[2] === 'pc') {
                return true;
            }
        }
        return false;
    }
    /**
     * "Step out" for Mock debug means:
     * 1. If the stack is empty behaves like normal "continue"
     * 2. If the stack is not empty, we continue until the PC saved in
     *   the return stack is reached.
     */
    stepOut() {
        while (true) {
            if (this.executeLine(this.currentLine)) {
                break;
            }
            if (this.updateCurrentLine()) {
                break;
            }
            if (this.findNextStatement()) {
                break;
            }
        }
    }
    getStepInTargets(frameId) {
        const line = this.getLine();
        const words = this.getWords(this.currentLine, line);
        // return nothing if frameId is out of range
        if (frameId < 0 || frameId >= words.length) {
            return [];
        }
        const { name, index } = words[frameId];
        // make every character of the frame a potential "step in" target
        return name.split('').map((c, ix) => {
            return {
                id: index + ix,
                label: `target: ${c}`
            };
        });
    }
    stack(startFrame, endFrame) {
        const line = this.getLine();
        const words = this.getWords(this.currentLine, line);
        words.push({ name: 'BOTTOM', line: -1, index: -1 }); // add a sentinel so that the stack is never empty...
        // if the line contains the word 'disassembly' we support to "disassemble" the line by adding an 'instruction' property to the stackframe
        const instruction = line.indexOf('disassembly') >= 0 ? this.instruction : undefined;
        const column = typeof this.currentColumn === 'number' ? this.currentColumn : undefined;
        const frames = [];
        // every word of the current line becomes a stack frame.
        for (let i = startFrame; i < Math.min(endFrame, words.length); i++) {
            const stackFrame = {
                index: i,
                name: `${words[i].name}(${i})`, // use a word of the line as the stackframe name
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
    setRegister(name, value) {
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
    evaluate(expression) {
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
                    }
                    catch (e) {
                        return undefined;
                    }
                }
                else {
                    try {
                        let address = parseInt(expression, 10);
                        if (Number.isNaN(address)) {
                            return undefined;
                        }
                        value = this._emulator.getData(address);
                    }
                    catch (e) {
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
    getBreakpoints(path, line) {
        return this.getWords(line, this.getLine(line)).filter(w => w.name.length > 8).map(w => w.index);
    }
    /*
     * Set breakpoint in file with given line.
     */
    async setBreakPoint(path, line) {
        path = this.normalizePathAndCasing(path);
        const bp = { verified: false, line, id: this.breakpointId++ };
        let bps = this.breakPoints.get(path);
        if (!bps) {
            bps = new Array();
            this.breakPoints.set(path, bps);
        }
        bps.push(bp);
        await this.verifyBreakpoints(path);
        return bp;
    }
    /*
     * Clear breakpoint in file with given line.
     */
    clearBreakPoint(path, line) {
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
    clearBreakpoints(path) {
        this.breakPoints.delete(this.normalizePathAndCasing(path));
    }
    setDataBreakpoint(address, accessType) {
        const x = accessType === 'readWrite' ? 'read write' : accessType;
        const t = this.breakAddresses.get(address);
        if (t) {
            if (t !== x) {
                this.breakAddresses.set(address, 'read write');
            }
        }
        else {
            this.breakAddresses.set(address, x);
        }
        return true;
    }
    clearAllDataBreakpoints() {
        this.breakAddresses.clear();
    }
    setExceptionsFilters(namedException, otherExceptions) {
        this.namedException = namedException;
        this.otherExceptions = otherExceptions;
    }
    setInstructionBreakpoint(address) {
        this.instructionBreakpoints.add(address);
        return true;
    }
    clearInstructionBreakpoints() {
        this.instructionBreakpoints.clear();
    }
    async getGlobalVariables(cancellationToken) {
        let a = [];
        for (let i = 0; i < 10; i++) {
            a.push(new RuntimeVariable(`global_${i}`, i));
            if (cancellationToken && cancellationToken()) {
                break;
            }
            await timeout(1000);
        }
        return a;
    }
    getLocalVariables() {
        let ACC = new RuntimeVariable("ACC", this._emulator.getRegister(registerCode.ACC));
        let IN1 = new RuntimeVariable("IN1", this._emulator.getRegister(registerCode.IN1));
        let IN2 = new RuntimeVariable("IN2", this._emulator.getRegister(registerCode.IN2));
        let PC = new RuntimeVariable("PC", this._emulator.getRegister(registerCode.PC));
        return [ACC, IN1, IN2, PC];
    }
    setLocalVariables(name, value) {
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
    disassemble(address, instructionCount) {
        const instructions = [];
        for (let a = address; a < address + instructionCount; a++) {
            if (a >= 0 && a < this.instructions.length) {
                instructions.push({
                    address: a,
                    instruction: this.instructions[a].name,
                    line: this.instructions[a].line
                });
            }
            else {
                instructions.push({
                    address: a,
                    instruction: 'nop'
                });
            }
        }
        return instructions;
    }
    // private methods
    getLine(line) {
        return this._sourceLines[line === undefined ? this.currentLine : line].trim();
    }
    getWords(l, line) {
        // break line into words
        const WORD_REGEXP = /[a-z]+/ig;
        const words = [];
        let match;
        while (match = WORD_REGEXP.exec(line)) {
            words.push({ name: match[0], line: l, index: match.index });
        }
        return words;
    }
    async loadSource(file) {
        if (this._sourceFile !== file) {
            this._sourceFile = this.normalizePathAndCasing(file);
            return this.initializeContents(await this.fileAccessor.readFile(file));
        }
        return true;
    }
    initializeContents(memory) {
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
        if (this._linesToInstructions.length > 0) {
            this._linesToInstructions = [];
        }
        if (this._instrToLines.length > 0) {
            this._instrToLines = [];
        }
        let instructions = [];
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
    findNextStatement(stepEvent) {
        for (let ln = this.currentLine; ln < this._sourceLines.length; ln++) {
            const breakpoints = this.breakPoints.get(this._sourceFile);
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
    executeLine(ln) {
        // 1. Map  line to corresponding instruction in emulator.
        let instr_number = this._linesToInstructions[ln];
        // If it is -1 the line is a comment.
        if (instr_number === -1) {
            return false;
        }
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
    async verifyBreakpoints(path) {
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
    sendEvent(event, ...args) {
        setTimeout(() => {
            this.emit(event, ...args);
        }, 0);
    }
    normalizePathAndCasing(path) {
        if (this.fileAccessor.isWindows) {
            return path.replace(/\//g, '\\').toLowerCase();
        }
        else {
            return path.replace(/\\/g, '/');
        }
    }
}
//# sourceMappingURL=retiRuntime.js.map