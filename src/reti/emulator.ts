import * as vscode from 'vscode';
import { ReTIConfig } from "../config";
import * as EmTI from "./ti/emulator_ti";
import * as EmOS from "./os/emulator_os";
import { ReTIState } from './ReTIInterfaces';

export interface IEmulator {
    inIsr:boolean;
    emulate(token: vscode.CancellationToken): Promise<string>;

    getData(address: number): number;

    step(): number ;

    isValidPC(pc: number): boolean;

    getCurrentInstruction(): number;

    getRegister(register: number): number;

    setRegister(register: number, value: number): void;

    getData(address: number): number;

    getRegisterCodes(): Record<string, number>;

    setData(address: number, value: number): void;

    isCallInstruction(): [boolean, number];
}

export function createEmulator(code: number[], isrs: number[], outPutChannel?: vscode.OutputChannel): IEmulator {
    try {
        if (ReTIConfig.isOS) {
            return new EmOS.EmulatorOS(code, isrs, outPutChannel);
        }
        else {
            return new EmTI.Emulator(code, isrs, outPutChannel);
        }
    } catch(err) {
        console.error("Emulator creation failed." , err);
        throw err;
    }

}