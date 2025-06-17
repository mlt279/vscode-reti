import EventEmitter from "events";
import { Emulator } from "../reti/emulator";
import { assembleLine } from "../reti/assembler";
import { parseString } from "../util/parser";
import { registerCode } from "../reti/retiStructure";
export class ReTIDebugger extends EventEmitter {
    _fileAccessor;
    _sourceFile = "";
    _lines = [];
    _emulator = new Emulator([], []);
    _currentline = 0;
    _breakPoints = new Map;
    _breakPointsID = 0;
    constructor(_fileAccessor) {
        super();
        this._fileAccessor = _fileAccessor;
    }
    async run() {
        await this.loadSource(this._sourceFile);
        this._currentline = 0;
        this.sendEvent("stopOnEntry");
    }
    continue() {
    }
    step() {
        let pc = this._emulator.getRegister(registerCode.PC);
        // TODO: Make sure this works with the actual instructions.
        if (pc < this._lines.length) {
            this._emulator.step();
            this.sendEvent('stopOnStep');
            this._currentline++;
        }
    }
    updateCurrentLine() {
        if (this._currentline > this._lines.length - 1) {
            this._currentline++;
        }
        else {
            this.sendEvent("end");
            return true;
        }
        return false;
    }
    sendEvent(event, ...args) {
        setTimeout(() => {
            this.emit(event, ...args);
        }, 0);
    }
    async setBreakPoint(path, line) {
        path = this.normalizePathAndCasing(path);
        const bp = {
            verified: false,
            line: line,
            id: this._breakPointsID++,
            instruction: 0
        };
        let bps = this._breakPoints.get(path);
        if (!bps) {
            bps = new Array();
            this._breakPoints.set(path, bps);
        }
        bps.push(bp);
        await this.verifyBreakpoints(path);
        return bp;
    }
    getBreakpoints(path, line) {
        return [];
    }
    clearBreakpoints(path) {
        this._breakPoints.delete(this.normalizePathAndCasing(path));
    }
    // TODO: Plan how to handle addresses vs lines
    // public setInstructionBreakpoint(address: number): boolean {
    // 	this.instructionBreakpoints.add(address);
    // 	return true;
    // }
    async getRegisters() {
    }
    async getMemory() {
    }
    // ________________________________________________________________________
    async loadSource(file) {
        if (this._sourceFile !== file) {
            this._sourceFile = this.normalizePathAndCasing(file);
            this.initializeContents(await this._fileAccessor.readFile(file));
        }
    }
    // ________________________________________________________________________
    async initializeContents(memory) {
        this._lines = parseString(new TextDecoder().decode(memory));
        let instructions = [];
        for (let i = 0; i < this._lines.length; i++) {
            /**
             * TODO: Whats with comments?
             */
            let [err, instr, msg] = assembleLine(this._lines[i]);
            if (err !== -1) {
                instructions.push(instr);
            }
            else {
                this.sendEvent("Assembly error", msg);
                return;
            }
        }
        this._emulator = new Emulator(instructions, []);
    }
    // ________________________________________________________________________
    async verifyBreakpoints(path) {
    }
    normalizePathAndCasing(path) {
        if (this._fileAccessor.isWindows) {
            return path.replace(/\//g, '\\').toLowerCase();
        }
        else {
            return path.replace(/\\/g, '/');
        }
    }
}
//# sourceMappingURL=retiDebugger.js.map