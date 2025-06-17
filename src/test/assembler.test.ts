// #region imports
import * as assert from 'assert';
import * as vscode from 'vscode';
import { randomInstruction } from '../util/randomReti';
import { decodeInstruction } from '../reti/disassembler';
import { assembleLine } from '../reti/assembler';
import { binToHex, hexToBin } from '../util/retiUtility';

//#endregion

suite('assembler Test Suite', async () => {
    test('Testing Assembly for 100 randomly generated instructions.', async () => {
        for (let i = 0; i < 100; i++) {
            let instruction = randomInstruction(24);
            let code = decodeInstruction(instruction)[0];
            let result = assembleLine(code.split(' '));
            let assembledCode = result[1];
            if (result[0] !== 0) {
                assert.strictEqual("Error when parsing: " + result[2], code);
            }
            if (instruction >> 27 !== 0b11000){
                assert.strictEqual(hexToBin(binToHex(assembledCode)).padStart(32, '0').replace(/(.{4})/g, '$1_').slice(0, -1) + " | " + code, hexToBin(binToHex(instruction)).padStart(32, '0').replace(/(.{4})/g, '$1_').slice(0, -1) + " | " + code);
            }
        }
    });
});