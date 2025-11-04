/**
 * Based on code by Michel Giehl (c) 2021, licensed under the MIT License.
 * Original source available under MIT License.
 * Modifications made by [Malte Pullich] (c) 2025.
 */

import { compileSingle } from "../../third-party-code/reti_compiler";
import { binToHex, generateBitMask, immediateAsTwoc, immediateUnsigned } from "../../util/retiUtility.js";
import { ReTIState } from "../ReTIInterfaces";

export enum osRegisterCode {
  PC = 0, IN1, IN2, ACC, SP, BAF, CS, DS, I, IVN
}

export const osRegisterNames = ["PC", "IN1", "IN2", "ACC", "SP", "BAF", "CS", "DS", "I"];

export const to32Bit = (n: number) => n >>> 0;
export const toSigned32 = (n: number) => (n << 0) >> 0;

const SRAM_SIZE = (1 << 12)
const EPROM_SIZE = (1 << 8)
const IVT_SIZE = 16;

export class ReTI_os {
    public ivtBase = 0;
    public process_start: number;
    private data_segment_size: number = 32;
    public numIsrs = 0;
    public registers: number[];
    public uart: number[];
    public sram: number[];
    public eprom: number[];

    public numInstrsISRs: number = 0;
    public numInstrsProgram: number = 0;


    private memoryMap: { [key: number]: number[] } 
    public bds: number;

    constructor(reti?: ReTI_os) {
        // create deep copy if argument is provided
        this.process_start = 3 + IVT_SIZE;
        this.data_segment_size = 32
        if (reti) {
            this.registers = [...reti.registers]
            this.uart = [...reti.uart]
            this.sram = [...reti.sram]
            this.eprom = [...reti.eprom]
            this.memoryMap = {
                0: this.eprom,
                1: this.uart,
                2: this.sram,
                3: this.eprom
            }
            this.bds = reti.bds
            this.numInstrsISRs = reti.numInstrsISRs;
            this.numInstrsProgram = reti.numInstrsProgram;
            this.ivtBase = reti.ivtBase;
            this.numIsrs = reti.numIsrs;
        } else {
            this.registers = new Array(9).fill(0)

            this.uart = new Array(8).fill(0)
            this.sram = new Array(SRAM_SIZE).fill(0)

            this.eprom = new Array(EPROM_SIZE)
            this.memoryMap = {
                0: this.eprom,
                1: this.uart,
                2: this.sram,
                3: this.eprom
            }
            this.bds = 0
            this.loadConstants()
        }
    }

    public to32Bit(num: number) {
        return num >>> 0
    }

    private loadEPROMStartProgram(){
        this.eprom[0] = compileSingle("")
    }

    public readProgram(mainCode: number[], isrCode: number[] = []) {
        let instrLen = mainCode.length;
        let isrLen = isrCode.length;

        this.numInstrsISRs = isrCode.length;
        this.numInstrsProgram = mainCode.length;


        this.eprom[0] = compileSingle("LOADI DS -2097152");
        // let DS = to32Bit(-2097152)
        // DS = 0xFFE00000

        this.eprom[1] = compileSingle("MULTI DS 1024");
        // DS = to32Bit(toSigned32(DS) * 1024);
        // DS = 0x80000000

        this.eprom[2] = compileSingle("MOVE DS SP");
        this.eprom[3] = compileSingle("MOVE DS BAF");
        this.eprom[4] = compileSingle("MOVE DS CS");
        // let SP = DS;
        // let BAF = DS;
        // let CS = DS;
        // SP = BAF = CS = DS = 0x80000000

        this.eprom[5] = compileSingle(`ADDI SP ${this.process_start + instrLen + isrLen + this.data_segment_size - 1}`);
        // SP = to32Bit(SP + this.process_start + instrLen + isrLen + this.data_segment_size - 1)

        this.eprom[6] = compileSingle("ADDI BAF 2");
        // BAF = to32Bit(BAF + 2)

        this.eprom[7] = compileSingle(`ADDI CS ${this.process_start + isrLen}`);
        // CS = to32Bit(CS + this.process_start + isrLen);

        this.eprom[8] = compileSingle(`ADDI DS ${this.process_start + isrLen + instrLen}`);
        // DS = to32Bit(CS + instrLen);

        this.eprom[9] = compileSingle("MOVE CS PC");
        // let PC = CS

        // Loading interrupt routines.
        for (let i = 0; i < isrLen; i++) {
            let instruction = isrCode[i]
            let instructionType = instruction >>> 30
            let condition = (instruction >>> 27) & 0x7
            let j = (instruction >>> 25) & 0x3
            let param = toSigned32(instruction & 0x3fffff)
            // In this case IVTE
            if (j === 3 && instructionType === 3) {
                if (!(param >= IVT_SIZE)) {
                this.sram[param] = i + this.process_start + 1 + 0x80000000;
                this.numIsrs += 1;
                }
            }
            this.sram[i + this.process_start] = instruction;

        }


        // Loading program.
        for (let i = 0; i < instrLen; i++) {
            this.sram[i + this.process_start + isrLen] = mainCode[i];
        }

        this.bds = this.process_start + isrLen + instrLen;
    }

    private loadConstants() {
        this.eprom[Math.pow(2, 16) - 1] = 1 << 30 // UART
        this.eprom[Math.pow(2, 16) - 2] = (1 << 31) >>> 0 // SRAM
        this.eprom[Math.pow(2, 16) - 3] = 0x70000000 // LOADI PC 0
        this.uart[2] = 1;
    }


    public memWrite(address: number, data: number) {
        const SEG_MASK = 0xC0000000;  // bits 31..30
        const BASE_MASK = 0x3FFFFFFF; // bits 29..0

        if (address >= Math.pow(2,31)) {
            // SRAM segment
            this.sram[address - Math.pow(2,31)] = this.to32Bit(data);
        } else if (address >= Math.pow(2,30)) {
            // UART segment (⚠ fixed offset)
            this.uart[address - Math.pow(2,30)] = this.to32Bit(data);
        } else {
            // Normal data segment — apply DS base
            const dsVal = this.registers[osRegisterCode.DS] >>> 0;
            const segment = (dsVal & SEG_MASK) >>> 30;
            const base = (dsVal & BASE_MASK) >>> 0;
            const abs = base + address;

            if (this.memoryMap[segment] === this.sram && abs >= SRAM_SIZE) {
                throw new Error(`Cannot write to address ${abs}`);
            }

            this.memoryMap[segment][abs] = this.to32Bit(data);
        }
    }



    public memRead(address: number, register: number | null, seg = osRegisterCode.DS): number {
        const SEG_MASK = 0xC0000000;
        const BASE_MASK = 0x3FFFFFFF;
        let data = 0;

        if (address >= Math.pow(2,31)) {
            data = this.sram[address - Math.pow(2,31)] || 0;
        } else if (address >= Math.pow(2,30)) {
            // ⚠ fixed UART offset
            data = this.uart[address - Math.pow(2,30)] || 0;
        } else {
            // Normal DS segment
            const segVal = this.registers[seg] >>> 0;
            const segment = (segVal & SEG_MASK) >>> 30;
            const base = (segVal & BASE_MASK) >>> 0;
            const abs = base + address;
            data = this.memoryMap[segment][abs] || 0;
        }

        if (register != null) {
            this.registers[register] = data;
        }
        return data;
    }


    private simulateUART(mode: string, data: number[]) {
        // UART writes data into R1 so the reti can read it.
        if (mode === "send") {
            if (data.length === 0) return false
            // check if R2 b1 == 0
            if ((this.uart[2] & 2) == 0) {
                this.uart[2] |= 2
                this.uart[1] = data[0] & 0xff
                data.shift()
                return true
            }
        } else if (mode === "receive") {
            if ((this.uart[2] & 1) === 0) {
                data.push(this.uart[0])
                this.uart[0] = 0
                this.uart[2] |= 1
            }
        }
        return false
    }

    // Returns the value of the register.
    // Use the registerCode enum to get the register.
    public getRegister(register: osRegisterCode): number {
        if (register === osRegisterCode.PC) {
            return immediateUnsigned(this.registers[register]);
        }
        return immediateAsTwoc(this.registers[register]);
    }

    // Sets the value of the register.
    // Use the registerCode enum to set the register.
    public setRegister(register: osRegisterCode, value: number) {
        this.registers[register] = value & generateBitMask(32);
    }

    // For debugging purposes. Returns the state of the ReTI (registers, data and code) as a string.
    public dumpState(): string {
        const SEG_MASK = 0xC0000000;   // bits 31–30
        const BASE_MASK = 0x3FFFFFFF;  // bits 29–0
        let state = "Registers:\n";
        for (let i = 0; i < this.registers.length; i++) {
            state += `${osRegisterNames[i]}: ${this.registers[i]}\n`;
        }

        // state += "\nEPROM:\n";
        // for (let i = 0; i < this.eprom.length; i++) {
        //     state += `${i}: ${binToHex(this.eprom[i])}\n`;
        // }

        // === NEW SECTION: Print logical data segment (DS) ===
        const dsVal = this.registers[osRegisterCode.DS] >>> 0;
        const segment = (dsVal & SEG_MASK) >>> 30;
        const base = (dsVal & BASE_MASK) >>> 0;
        const dsArray = this.memoryMap[segment];

        state += `\nDATA SEGMENT (DS = 0x${dsVal.toString(16)}):\n`;
        const maxEntries = 32; // adjust for how many you want to print
        for (let i = 0; i < maxEntries; i++) {
            const abs = base + i;
            const val = dsArray?.[abs] ?? 0;
            state += `${i}: ${binToHex(val)}\n`;
        }

        // Optional: print full SRAM for low-level debugging
        state += "\nSRAM (raw):\n";
        for (let i = 0; i < 32; i++) { // print first 32 for brevity
            state += `${i}: ${binToHex(this.sram[i])}\n`;
        }

        return state;
    }

}