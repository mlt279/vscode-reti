/**
 * Based on code by Michel Giehl (c) 2021, licensed under the MIT License.
 * Original source available under MIT License.
 * Modifications made by [Malte Pullich] (c) 2025.
 */
import { compileSingle } from "../../third-party-code/reti_compiler";
import { IReTIArchitecture, IReTIPort } from "../ReTIInterfaces";
import * as vscode from 'vscode';

export enum osRegisterCode {
  PC = 0, IN1, IN2, ACC, SP, BAF, CS, DS, I
}

const SRAM_SIZE = (1 << 12)
const EPROM_SIZE = (1 << 8)

export class ReTI_os implements IReTIArchitecture {
    readonly register_names = ["PC", "IN1", "IN2", "ACC", "SP", "BAF", "CS", "DS", "I"];

    step(_cpu: IReTIPort, _instruction: number) {
        return 0;
    }

    emulate(_cpu: IReTIPort,  _token: vscode.CancellationToken) {
        return 0;
    }
}
