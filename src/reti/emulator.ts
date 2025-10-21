import * as vscode from 'vscode';
import { ReTIConfig } from "../config";
import * as EmTI from "./ti/emulator_ti";
import * as EmOS from "./os/emulator_os";
import { ReTIState } from './ReTIInterfaces';

export interface IEmulator {
    emulate(token: vscode.CancellationToken): Promise<string>;

    getData(address: number): number;

    step(): number ; // XXXXXX

    isValidPC(pc: number): boolean;  // XXXXXX

    getCurrentInstruction(): number;

    getRegister(register: number): number;

    setRegister(register: number, value: number): void;

    getData(address: number): number;
}

export function createEmulator(code: number[], data: number[], outPutChannel?: vscode.OutputChannel): IEmulator {
    if (ReTIConfig.isOS) {
        return new EmOS.EmulatorOS(code, data, outPutChannel);
    }
    else {
        return new EmTI.Emulator(code, data, outPutChannel);
    }
}