import * as vscode from 'vscode';
import { computeCode, opType, registerCode, ReTI, ReTIState } from './retiStructure';
import { generateBitMask, immediateAsTwoc, immediateUnsigned } from '../util/retiUtility';
import { assembleLine } from './assembler';

// export async function emulate(code: string[][]) {
//     // Parsing the instruction file.
//     let instructions: number[] = [];
//     for (let i = 0; i < code.length; i++) {
//         let errCode = 0;
//         let errMessage = "";
//         let line = code[i];
//         let instruction = 0;
//         [errCode, instruction, errMessage] = assembleLine(line);
//         if (errCode !== 0) {
//             vscode.window.showErrorMessage(`Error when parsing: ${errMessage}`);
//             return;
//         }
//         instructions.push(instruction);
//     }
//     let emulator = new Emulator(instructions, []);

//     while (emulator.getCurrentInstruction() !== 0) {
//         emulator.step();
//         await vscode.window.showInformationMessage(emulator.exportState());
//     }
// }

export class Emulator{
    private reti: ReTI;
    private initial_data: number[];
    private outPutChannel: vscode.OutputChannel;

    constructor(code: number[], data: number[], outPutChannel: vscode.OutputChannel) {
        this.initial_data = data;
        this.reti = new ReTI(code, [...data]);
        this.outPutChannel = outPutChannel;
    }

    public async emulate(token: vscode.CancellationToken): Promise<ReTIState> {
        while (true) {
            if (token.isCancellationRequested) {
                break;
            }

            await new Promise((resolve) => setImmediate(resolve, 0));

            let pc = this.reti.getRegister(registerCode.PC);
            if (pc >= this.reti.shadow.codeSize) {
                this.outPutChannel.appendLine(`Stopping emulation. PC is out of code range. PC = ${pc}`);
                break;
            }

            let instruction = this.reti.getCode(pc);

            if (this.execute(instruction) !== 0) {
                this.outPutChannel.appendLine(`Stopping emulation. Invalid instruction @${pc}.`);
                break;
            }

            let nextPC = this.reti.getRegister(registerCode.PC);
            if (pc === nextPC) {
                this.outPutChannel.appendLine(`Stopping emulation. Instruction @${pc} causes infinite loop.`);
                break;
            }

            if (nextPC >= this.reti.shadow.codeSize) {
                this.outPutChannel.appendLine(`Stopping emulation. Instruction @${pc} causes PC to be out of code range. PC = ${nextPC}`);
                break;
            }
        }
        this.outPutChannel.show();
        return this.reti.exportState();
    }

    // Resets ReTI to starting state.
    // Registers = 0, data = starting_data
    public reset() {
        this.reti.setMemory([...this.initial_data]);
        for (let i = 0; i < 4; i++){
            this.reti.setRegister(i, 0);
        }
    }

    public step() {
        const instruction = this.reti.getCode(this.reti.getRegister(registerCode.PC));
        this.execute(instruction);
    }

    private execute(instruction: number | string[]): number {
        if (typeof instruction !== 'number') {
            let errCode = 0;
            let errMessage = "";
            [errCode, instruction, errMessage ] = assembleLine(instruction);
            if (errCode !== 0) {
                vscode.window.showErrorMessage(`Error when parsing: ${errMessage}`);
                return 0;
            }
        }
        let operation = instruction >> 30 & 0b11;
        switch (operation) {
            case opType.COMPUTE:
                return this.executeCompute(instruction);
            case opType.LOAD:
                return this.executeLoad(instruction);
            case opType.STORE:
                return this.executeStore(instruction);
            case opType.JUMP:
                return this.executeJump(instruction);
            // Should not be needed because checking for 2 bits only has 4 possible combinations.
            default:
                return 1;
        }
    }

    // TODO: What should the real behaviour be when an invalid compute code is given? Abort or NOP?
    private executeCompute(instruction: number): number {
        let mi = instruction >> 29 & 0b1;
        let f = instruction >> 26 & 0b111;
        let destination = instruction >> 24 & 0b11;
        let immediate = instruction & generateBitMask(24);
    
        if (mi === 1) {
            immediate = this.reti.getData(immediateUnsigned(immediate));
        }

        let result = 0;
        switch (f) {
            case computeCode.SUB:
                result = this.reti.getRegister(destination) - immediate;
                break;
            case computeCode.ADD:
                result = this.reti.getRegister(destination) + immediate;
                break;
            case computeCode.OPLUS:
                result = this.reti.getRegister(destination) ^ immediate;
                break;
            case computeCode.OR:
                result = this.reti.getRegister(destination) | immediate;
                break;
            case computeCode.AND:
                result = this.reti.getRegister(destination) & immediate;
                break;
            default:
                this.outPutChannel.appendLine(`Invalid compute code for compute operation: ${f} at PC = ${this.getRegister(registerCode.PC)}.`);
                return 1;
        }
        this.reti.setRegister(destination, result < 0 ? immediateAsTwoc(result, 32): result);

        if (destination !== registerCode.PC) {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
        }
        return 0;
    }

    // TODO: What if the immediate is calling a register where code is saved?
    private executeLoad(instruction: number): number {
        let mode = instruction >> 28 & 0b11;
        let destination = instruction >> 24 & 0b11;
        let immediate = instruction & generateBitMask(24);

        switch (mode) {
            case 0b00:
                immediate = this.reti.getData(immediateUnsigned(immediate));
                break;
                case 0b11:
                immediate = immediateAsTwoc(immediate);
                break;
            default:
                immediate = immediateAsTwoc(immediate);
                immediate = this.reti.getData(immediateUnsigned(this.reti.getRegister(mode) + immediate));
                break;
        }
        this.reti.setRegister(destination, immediate);
        if (destination !== registerCode.PC) {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
        }
        return 0;
    }

    // TODO: What if the immediate is referencing a register where code is saved?
    private executeStore(instruction: number): number {
            let mode = instruction >> 28 & 0b11;
            let source = instruction >> 26 & 0b11;
            let destination = instruction >> 24 & 0b11;
            let immediate = instruction & generateBitMask(24);
            switch (mode) {
                // STORE
                case 0b00:
                    this.reti.setData(immediateUnsigned(immediate), this.reti.getRegister(registerCode.ACC));
                    break;
                // MOVE
                case 0b11:
                    this.reti.setRegister(destination, this.reti.getRegister(source));
                    break;
                // STOREIN1 and STOREIN2, both are handled the same. Mode := registerCode.IN1 or registerCode.IN2
                default:
                    immediate = immediateAsTwoc(immediate);
                    this.reti.setData(immediateUnsigned(this.reti.getRegister(mode) + immediate), this.reti.getRegister(registerCode.ACC));
                    break;
            }

            if (destination !== registerCode.PC || mode !== 0b11) {
                this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
            }
            return 0;
    }

    // TODO: What if PC would be < 0? What if PC would be > codeSize?
    // If < 0: PC would be handled as an unsigned number so that is not possible, but it 
    // would lead to undefined behaviour in the code since it would be a huge number.
    // If > codeSize the next iteration of the loop will just stop execution.
    private executeJump(instruction: number): number {
        let condition = instruction >> 27 & 0b111;
        let immediate = immediateAsTwoc(instruction & generateBitMask(24));
       
        let gt = condition >> 2 & 0b1;
        let eq = condition >> 1 & 0b1;
        let lt = condition & 0b1;
        let ACC = this.reti.getRegister(registerCode.ACC);

        // NOTE: Even if the jump command would cause PC to be negative (negative immediate > PC) PC would
        // turn out to be a positive number probably outside of the code range since PC is always handled as an unsigned number.
        // This is not addressed as the ReTI would probably also not do this. Instead it will be handled in the next iteration of
        // instruction very likely as PC being outside of code range.
        if ((gt && (ACC > 0) ) || (eq && (ACC === 0)) || (lt && (ACC < 0))) {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + immediate);
        }
        else {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
        }
        return 0;
    }

    public exportState(): string {
        return this.reti.dumpState();
    }

    public getRegister(register: registerCode): number {
        return this.reti.getRegister(register);
    }

    public getData(address: number): number {
        return this.reti.getData(address);
    }

    public setData(address: number, value: number) {
        this.reti.setData(address, value);
    }

    public getCurrentInstruction(): number {
        return this.reti.getCode(this.reti.getRegister(registerCode.PC));
    }
}