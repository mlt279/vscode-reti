import * as vscode from 'vscode';
import { waitForMS } from './countdown';
import { computeCode, opType, registerCode, ReTI } from './retiStructure';
import { generateBitMask, immediateAsTwoc, immediateUnsigned } from './retiUtility';
import { assembleLine } from './assembler';

export async function emulate(code: string[][]) {

    let data: number[] = [];
    for (let i = 0; i < 128; i++) {
        data.push(i);
    }
    let instructions: number[] = [];
    for (let i = 0; i < code.length; i++) {
        let errCode = 0;
        let errMessage = "";
        let line = code[i];
        let instruction = 0;
        [errCode, instruction, errMessage] = assembleLine(line);
        if (errCode !== 0) {
            vscode.window.showErrorMessage(`Error when parsing: ${errMessage}`);
            return;
        }
        instructions.push(instruction);
    }
    let emulator = new Emulator(instructions, data);

    while (emulator.getCurrentInstruction() !== 0) {
        emulator.step();
        vscode.window.showInformationMessage(emulator.dumpState());
        await waitForMS(100);
    }
}

export class Emulator{
    private reti: ReTI;
    private run: boolean = false;
    private initial_data: number[];

    constructor(code: number[], data: number[]) {
        this.initial_data = data;
        this.reti = new ReTI(code, data);
    }

    // Resets ReTI to starting state.
    // Registers = 0, data = starting_data
    public reset() {
        this.reti.setMemory(this.initial_data);
        for (let i = 0; i < 4; i++){
            this.reti.setRegister(i, 0);
        }
    }

    // 
    public async start(){
        this.run = true;
        while (this.run) {
            this.step();
        }
    }

    public stop() {
        this.run = false;
    }

    public step() {
        const instruction = this.reti.getCode(this.reti.getRegister(registerCode.PC));
        this.execute(instruction);
    }

    private execute(instruction: number | string[]) {
        if (typeof instruction !== 'number') {
            let errCode = 0;
            let errMessage = "";
            [errCode, instruction, errMessage ] = assembleLine(instruction);
            if (errCode !== 0) {
                vscode.window.showErrorMessage(`Error when parsing: ${errMessage}`);
                return;
            }
        }
        let operation = instruction >> 30 & 0b11;
        switch (operation) {
            case opType.COMPUTE:
                this.executeCompute(instruction);
                break;
            case opType.LOAD:
                this.executeLoad(instruction);
                break;
            case opType.STORE:
                this.executeStore(instruction);
                break;
            case opType.JUMP:
                this.executeJump(instruction);
                break;
            default:
                break;
        }
    }

    private executeCompute(instruction: number) {
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
                break;
        }
        this.reti.setRegister(destination, result < 0 ? immediateAsTwoc(result) : result);

        if (destination !== registerCode.PC) {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
        }
    }

    private executeLoad(instruction: number) {
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
                immediate = this.reti.getData(immediateUnsigned(this.reti.getRegister(mode) + immediateAsTwoc(immediate)));
                break;
        }
        this.reti.setRegister(destination, immediate);
        if (destination !== registerCode.PC) {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
        }
    }

    private executeStore(instruction: number) {
            let mode = instruction >> 28 & 0b11;
            let source = instruction >> 26 & 0b11;
            let destination = instruction >> 24 & 0b11;
            let immediate = instruction & generateBitMask(24);
            switch (mode) {
                case 0b00:
                    this.reti.setData(immediateUnsigned(immediate), this.reti.getRegister(registerCode.ACC));
                    break;
                case 0b11:
                    this.reti.setRegister(destination, this.reti.getRegister(source));
                // IN1 and IN2 are handled the same.
                default:
                    immediate = immediateAsTwoc(immediate);
                    this.reti.setData(immediateUnsigned(this.reti.getRegister(mode) + immediate), this.reti.getRegister(registerCode.ACC));
                    break;
            }

            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
    }

    private executeJump(instruction: number) {
        let condition = instruction >> 27 & 0b111;
        let immediate = immediateAsTwoc(instruction & generateBitMask(24));
       
        let gt = condition >> 2 & 0b1;
        let eq = condition >> 1 & 0b1;
        let lt = condition & 0b1;
        let ACC = this.reti.getRegister(registerCode.ACC);

        if ((gt && (ACC > 0) ) || (eq && (ACC === 0)) || (lt && (ACC < 0))) {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + immediate);
        }
        else {
            this.reti.setRegister(registerCode.PC, this.reti.getRegister(registerCode.PC) + 1);
        }
    }

    public dumpState(): string {
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