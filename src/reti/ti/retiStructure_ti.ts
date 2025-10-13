import { binToHex, generateBitMask, immediateAsTwoc, immediateUnsigned } from "../../util/retiUtility.js";

const chunkSize = 2**16;

export interface ReTIState {
    registers: number[];
    data: Map<number, number>;
    endCondition: string;
}

export enum opType {
    COMPUTE = 0b00,
    LOAD = 0b01,
    STORE = 0b10,
    JUMP = 0b11,
}

export enum registerCode {
    PC = 0b00,
    IN1 = 0b01,
    IN2 = 0b10,
    ACC = 0b11,
}

export enum conditionCode {
    LESS = 0b001,
    EQUAL = 0b010,
    GREATER = 0b100,
}

export enum computeCode {
    SUB = 0b010,
    ADD = 0b011,
    OPLUS = 0b100,
    OR = 0b101,
    AND = 0b110,
}

interface shadowReTI {
    codeSize: number;
    memory: boolean[];
}

export function stateToString(state: ReTIState): string{
    let result = "";
    result += "Registers:\n";
    result += `PC: ${state.registers[0]}\n`;
    result += `IN1: ${state.registers[1]}\n`;
    result += `IN2: ${state.registers[2]}\n`;
    result += `ACC: ${state.registers[3]}\n`;

    result += "\nData:\n";
    for (let [address, data] of state.data) {
        result += `${address}: ${binToHex(data)}\n`;
    }

    return result;
}

export class ReTI {
    // Memory is stored in chunks of size specified in chunkSize in the constructor.
    private memory: Map<number, number[]>;
    private registers: number[];
    public readonly shadow: shadowReTI;


    constructor(code: number[], data: number[]) {
        this.memory = new Map<number, number[]>();
        this.shadow = { memory: [], codeSize: code.length };
        this.registers = new Array<number>(4).fill(0);
 
        this.memory.set(0, code);
        this.shadow.memory[0] = true;
        if (data.length <= chunkSize) {
            this.memory.set(1, [...data, ...new Array(chunkSize - data.length).fill(0)]);
            this.shadow.memory.push(true);
        }
        else {
            let i = 1;
            while (data.length > 0) {
                this.memory.set(i, data.splice(0, chunkSize));
                i++;
                this.shadow.memory.push(true);
            }
        }
    }

    // Sets the data memory to the given data.
    public setMemory(data: number[]) {
        // Resetting memory except code.
        this.shadow.memory = [false];
        for (let key of this.memory.keys()) {
            if (key !== 0) {
                this.memory.delete(key);
            }
        }

        // Setting the new data.
        if (data.length <= chunkSize) {
            this.memory.set(1, [...data, ...new Array(chunkSize - data.length).fill(0)]);
            this.shadow.memory[1] = true;
        }
        else {
            let i = 1;
            while (data.length > 0) {
                this.memory.set(i, data.splice(0, chunkSize));
                i++;
                this.shadow.memory.push(true);
            }
        }
    }

    // TODO: Do I continue to handle 0 as 0 + codeSize or do I throw an error?
    // Give an adress and a value both as number to write the value of the word to the data memory.
    public setData(address: number, data: number): number {
        // TODO: If I don't want to handle 0 as 0 + codeSize, I have to remove the - this.shadow.codeSize
        if (address >= 2**32 - this.shadow.codeSize || this.shadow.memory[Math.floor(address / chunkSize)] === false) {
            return 1;
        }

        let memoryChunk = this.memory.get(Math.floor(address / chunkSize) + 1);

        // This will initialize a new chunk of memory if nothing has been stored at the address yet.
        if (this.shadow.memory[Math.floor(address / chunkSize) + 1] === undefined || memoryChunk === undefined) {
            this.memory.set(Math.floor(address / chunkSize) + 1, new Array(chunkSize).fill(0));
            this.shadow.memory[Math.floor(address / chunkSize) + 1] = true;
            memoryChunk = this.memory.get(Math.floor(address / chunkSize) + 1);
        }

        // True means the address is a writable data cell (not code).
        if (this.shadow.memory[Math.floor(address / chunkSize) + 1] === true) {
            if (memoryChunk === undefined) {
                return 1;
            }
            memoryChunk[address % chunkSize] = data;
        }
        return 0;
    }

    // Returns the word stored add the given adress as a number.
    public getCode(address: number): number {
        if (address >= this.shadow.codeSize) {
            return 0;
        }
        let code = this.memory.get(0);
        if (code === undefined) {
            return 0;
        }
        return code[address];
    }

    // Returns the word stored at the given adress as a number.
    public getData(address: number): number {
        if (address >= Math.min(this.shadow.memory.length * chunkSize, 2**32)) {
            return 0;
        }
        let memoryChunk = this.memory.get(Math.floor(address / chunkSize) + 1);
        if (memoryChunk === undefined) {
            return 0;
        }
        return memoryChunk[address % chunkSize] === undefined ? 0 : memoryChunk[address % chunkSize];
    }

    // Returns the value of the register.
    // Use the registerCode enum to get the register.
    public getRegister(register: registerCode): number {
        if (register === registerCode.PC) {
            return immediateUnsigned(this.registers[register]);
        }
        return immediateAsTwoc(this.registers[register]);
    }

    // Sets the value of the register.
    // Use the registerCode enum to set the register.
    public setRegister(register: registerCode, value: number) {
        this.registers[register] = value & generateBitMask(32);
    }

    // For debugging purposes. Returns the state of the ReTI (registers, data and code) as a string.
    public dumpState(): string {
        let state = "";
        state += "Registers:\n";
        state += `PC: ${this.getRegister(registerCode.PC)}\n`;
        state += `IN1: ${this.getRegister(registerCode.IN1)}\n`;
        state += `IN2: ${this.getRegister(registerCode.IN2)}\n`;
        state += `ACC: ${this.getRegister(registerCode.ACC)}\n`;


        state += "\nCode:\n";

        for (let i = 0; i < this.shadow.codeSize; i++) {
            state += `${i}: ${binToHex(this.getCode(i))}\n`;
        }

        state += "\nData:\n";
        for (let [address, data] of this.getNoneZeroData()) {
            if (address < this.shadow.codeSize) {
                continue;
            }
            state += `${address}: ${binToHex(data)}\n`;
        }

        return state;
    }

    private getRealAdress(chunkKey: number, arrayIndex: number): number {
        return (chunkKey - 1) * chunkSize + arrayIndex + this.shadow.codeSize;
    }

    public getNoneZeroData(): Map<number, number> {
        let current_address = 0;
        let noneZero = new Map<number, number>();
        this.memory.forEach((element, chunkKey) => {
            for (let i = 0; i < element.length; i++) {
                current_address = chunkKey === 0 ? i : this.getRealAdress(chunkKey, i);
                if (element[i] !== 0) {
                    noneZero.set(current_address, element[i]);
                }
            }
        });
        return noneZero;
    }

    public exportState(): ReTIState {
        return { registers: [...this.registers], data: this.getNoneZeroData(), endCondition: "" };
    }
}
