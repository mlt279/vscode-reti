import EventEmitter from "events";
import { Emulator } from "../reti/emulator";
import { assembleFile, assembleLine } from "../reti/assembler";
import { parseString } from "../util/parser";
import { registerCode } from "../reti/retiStructure";

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}

export interface IRetiBreakpoint {
    id: number;
	line: number;
	verified: boolean;
    instruction: number;
}

export class ReTIDebugger extends EventEmitter {
    private _sourceFile: string = "";
    private _lines: string[][] = [];
    
    private _emulator: Emulator = new Emulator([], []);

    private _currentline = 0;

    private _breakPoints = new Map<string, IRetiBreakpoint[]>;

    private _breakPointsID = 0;

    constructor(private _fileAccessor: FileAccessor) {
        super();
    }

    public async run() {
        await this.loadSource(this._sourceFile);
        this._currentline = 0;
        this.sendEvent("stopOnEntry");
    }

    public continue() {

    }

    public step() {
        let pc = this._emulator.getRegister(registerCode.PC);
        // TODO: Make sure this works with the actual instructions.
        if (pc < this._lines.length) {
            this._emulator.step();
            this.sendEvent('stopOnStep');
            this._currentline++;
        }
    }

    private updateCurrentLine(): boolean {
        if (this._currentline > this._lines.length - 1) {
            this._currentline ++;
        }
        else {
            this.sendEvent("end");
            return true;
        }
        return false;
    }

	private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

    public async setBreakPoint(path: string, line: number):
    Promise<IRetiBreakpoint> {
        path = this.normalizePathAndCasing(path);

        const bp: IRetiBreakpoint = {
            verified: false,
            line: line, 
            id: this._breakPointsID++, 
            instruction: 0 
        };
        let bps = this._breakPoints.get(path);
        if (!bps) {
            bps = new Array<IRetiBreakpoint>();
            this._breakPoints.set(path, bps);
        }
        bps.push(bp);

        await this.verifyBreakpoints(path);

        return bp;
    }

    public getBreakpoints(path: string, line: number): number[] {
        return [];
    }

	public clearBreakpoints(path: string): void {
		this._breakPoints.delete(this.normalizePathAndCasing(path));
	}

    // TODO: Plan how to handle addresses vs lines
    // public setInstructionBreakpoint(address: number): boolean {
	// 	this.instructionBreakpoints.add(address);
	// 	return true;
	// }

    public async getRegisters() {

    }

    public async getMemory() {

    }

    // ________________________________________________________________________
    private async loadSource(file: string): Promise<void> {
		if (this._sourceFile !== file) {
			this._sourceFile = this.normalizePathAndCasing(file);
			this.initializeContents(await this._fileAccessor.readFile(file));
		}
	}

    // ________________________________________________________________________
    private async initializeContents(memory: Uint8Array): Promise<void> {
        this._lines = parseString(new TextDecoder().decode(memory));
        let instructions: number[] = [];
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
    private async verifyBreakpoints(path: string): Promise<void> {

    }

	private normalizePathAndCasing(path: string) {
		if (this._fileAccessor.isWindows) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}
}