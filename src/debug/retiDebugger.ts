import EventEmitter from "events";
import { Emulator } from "../reti/emulator";

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}

export interface IRetiBreakpoint {
    id: number;
    line: number;
    instruction: number;
}

export class ReTIDebugger extends EventEmitter {
    private _sourceFile: string = "";
    private _lines: string[] = [];
    
    private _emulator: Emulator = new Emulator([], []);

    private _currentline = 0;

    private _breakPoints = new Map<string, IRetiBreakpoint[]>;

    private _breakPointsID = 0;

    constructor(private _fileAccessor: FileAccessor) {
        super();
    }

    public async run() {

    }

    public continue() {

    }

    public step() {

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

    // _______________________________________________________________________
    private async loadSource(file: string): Promise<void> {
		if (this._sourceFile !== file) {
			this._sourceFile = this.normalizePathAndCasing(file);
			this.initializeContents(await this._fileAccessor.readFile(file));
		}
	}

    private initializeContents(something: any) {

    }

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