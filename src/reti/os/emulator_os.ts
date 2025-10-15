/**
 * Based on code by Michel Giehl (c) 2021, licensed under the MIT License.
 * Original source available under MIT License.
 * Modifications made by [Malte Pullich] (c) 2025.
 */
import { compileSingle } from "../../third-party-code/reti_compiler";
import { IEmulator } from "../emulator";
import { IReTIArchitecture, IReTIPort, ReTIState } from "../ReTIInterfaces";
import { ReTI_os } from "./retiStructure_os";
import * as vscode from 'vscode';

export enum osRegisterCode {
  PC = 0, IN1, IN2, ACC, SP, BAF, CS, DS, I
}

const SRAM_SIZE = (1 << 12)
const EPROM_SIZE = (1 << 8)

// class ReTIPort_os implements IReTIPort {
//     constructor(private os: ReTI_os) {

//     }

//     getRegister(index: number): number { return this.os.getRegister(index as any); }
//     setRegister(index: number, value: number): void { this.os.setRegister(index as any, value); }

//     getMem(addr: number): number { return this.os.getData(addr); }
//     setMem(addr: number, value: number): void { this.os.setData(addr, value); }

//     getCode(addr: number): number { return this.os.getCode(addr); }
//     codeSize(): number { return this.os.shadow.codeSize; }

//     getPC(): number { return this.os.getRegister(0 as any); } 
//     setPC(v: number): void { this.os.setRegister(0 as any, v); }
// }

export class EmulatorOS implements IEmulator{
    private reti: ReTI_os;
    private outputChannel?: vscode.OutputChannel;

    constructor(code: number[], data: number[], outPutChannel?: vscode.OutputChannel) {
        this.reti = new ReTI_os();
        this.outputChannel = outPutChannel;

        this.reti.readProgram(code);
    }

    public async emulate(token: vscode.CancellationToken): Promise<string> {
        let end_cnd = ""
        while (true) {
            if (token.isCancellationRequested) {
                this.outputChannel?.appendLine("Emulation stopped.");
                end_cnd = "Emulation stopped.";
                break;
            }

            await new Promise((resolve) => setImmediate(resolve, 0));

            this.fetch();
            let old_pc = this.getRegister(osRegisterCode.PC);
            this.execute();
            let new_pc = this.getRegister(osRegisterCode.PC);

            if (old_pc === new_pc) {
                this.outputChannel?.appendLine("End of Program reached.");
                end_cnd = "End of Program.";
                break;
            }
        }
        this.outputChannel?.show();
        let export_state = this.reti.dumpState();
        export_state += "\n" + end_cnd;
        return export_state;
    }

    public toSimpleNum(num: number) {
        if (num >= Math.pow(2,31)) {
            return num - Math.pow(2,31)
        }
        if (num >= Math.pow(2,30)) {
            return num - Math.pow(2,30)
        }
        return num
    }

    public to32Bit(num: number) {
        return num >>> 0
    }

    private fetch() {
        let instr = this.reti.getRegister(osRegisterCode.PC);
        // TODO: Use getters and setters
        if (instr >= Math.pow(2,31)) {
            this.reti.registers[osRegisterCode.I] = this.reti.sram[instr - Math.pow(2,31)]
        } else if (instr >= Math.pow(2,30)) {
            this.reti.registers[osRegisterCode.I] = this.reti.uart[instr - Math.pow(2,30)]
        } else {
            this.reti.registers[osRegisterCode.I] = this.reti.eprom[instr]
        }
    }

    private execute() {
        let instruction = this.reti.registers[osRegisterCode.I]
        let instructionType = instruction >>> 30
        switch (instructionType) {
            case 0: // COMPUTE
                this.compute(instruction)
                break
            case 1: // LOAD
                this.load(instruction)
                break
            case 2: // STORE
                this.store(instruction)
                break
            case 3: // JUMP
                this.jump(instruction)
                break
        }
    }

    private load(instruction: number) {
        let mode = (instruction >>> 28) & 0x3
        let addr = (instruction >>> 25) & 0x7
        let dest = (instruction >>> 22) & 0x7
        let param = instruction & 0x3fffff
        switch (mode) {
            case 0b00: // LOAD
                this.reti.memRead(param, dest)
                break
            case 0b01: // LOADIN
                this.reti.memRead(this.reti.registers[addr] + this.toSigned(param), dest)
                break
            case 0b11: // LOADI
                this.reti.registers[dest] = this.toSigned(param)
                break
        }
        if (dest != osRegisterCode.PC) {
            this.reti.registers[osRegisterCode.PC]++
        }
    }

    private toSigned(num: number): number {
        return num - Math.pow(2, 21)
    }

    private store(instruction: number) {
        let mode = (instruction >>> 28) & 0x3
        let source = (instruction >>> 25) & 0x7
        let dest = (instruction >>> 22) & 0x7
        let param = instruction & 0x3fffff
        switch (mode) {
            case 0b00: // STORE
                this.reti.memWrite(param, this.reti.registers[source])
                break
            case 0b01: // STOREIN
                this.reti.memWrite(this.reti.registers[dest] + this.toSigned(param), this.reti.registers[source])
                break
            case 0b11: // MOVE
                this.reti.registers[dest] = this.to32Bit(this.reti.registers[source])
                // don't increase PC if destination is PC
                if (dest == osRegisterCode.PC) {
                    return
                }
        }
        this.reti.registers[osRegisterCode.PC]++
    }

    private jump(instruction: number) {
        let condition = (instruction >>> 27) & 0x7
        let j = (instruction >>> 25) & 0x3
        let param = this.toSigned(instruction & 0x3fffff)
        let accRegister = this.reti.registers[osRegisterCode.ACC]
        accRegister = ((~(accRegister >>> 0) + 1) * -1);
        const conditionMap: boolean[] = [
            false,
            accRegister > 0,
            accRegister == 0,
            accRegister >= 0,
            accRegister < 0,
            accRegister != 0,
            accRegister <= 0,
            true,
        ]
        // INT i & RTI
        if (j === 1) {
            // TODO
            // statusText(true, "info", `<strong>OUTPUT</strong> ${this.registers[param]}`)
        }
        // TODO
        if (j === 2) {
            throw new Error("Not yet implemented")
        }

        if (conditionMap[condition]) {
            this.reti.registers[osRegisterCode.PC] += param
            // animateCOMPUTEI(0, 0)
        } else {
            this.reti.registers[osRegisterCode.PC]++
        }

        if (this.reti.getRegister(osRegisterCode.PC) > 500) {
            let x = 0;
        }
    }

    private compute(instruction: number) {
        let computeImmidiate = (instruction >>> 29) & 1
        let registerOnly = (instruction >>> 28) & 1
        let func = (instruction >>> 25) & 0x7
        let dest = (instruction >>> 22) & 0x7
        let source = (instruction >>> 19) & 0x7
        let param = instruction & 0x3ffff
        // param is only 19 bits long if command is register only
        if (registerOnly) {
            param = instruction & 0x7ffff
        }
        let s = registerOnly ? this.reti.registers[source] : param
        // read from M[s] is not compute immidiate or register only
        s = computeImmidiate || registerOnly ? s : this.reti.memRead(s, null)
        let r = this.reti.registers[dest]
        switch (func) {
            case 0:
                r += s
                break
            case 1:
                r -= s
                break
            case 2:
                r *= s
                break
            case 3:
                r /= s
                break
            case 4:
                r %= s
                break
            case 5:
                r ^= s
                break
            case 6:
                r |= s
                break
            case 7:
                r &= s
                break
        }
        this.reti.registers[dest] = this.to32Bit(r)
        this.reti.registers[osRegisterCode.PC]++
    }
    public exportState(): string {
        return this.reti.dumpState();
    }

    public getRegister(register: osRegisterCode): number {
        return this.reti.getRegister(register);
    }

    public setRegister(register: osRegisterCode, value: number) {
        this.reti.setRegister(register, value);
    }

    public getData(address: number): number {
        return this.reti.memRead(address, null);
    }

    public setData(address: number, value: number) {
        this.reti.memWrite(address, value);
    }

    public getCurrentInstruction(): number {
        return this.reti.getRegister(osRegisterCode.I);
    }
}
