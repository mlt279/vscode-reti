import { IReTIPort, IReTIArchitecture } from "../ReTIInterfaces";
import * as vscode from 'vscode';

export class ReTI_ti implements IReTIArchitecture {
    readonly register_names = ["PC", "IN1", "IN2", "ACC"];

    step(_cpu: IReTIPort, _instruction: number): number {
        return 0;
    }

    emulate(_cpu: IReTIPort,  _token: vscode.CancellationToken) {

    }
}