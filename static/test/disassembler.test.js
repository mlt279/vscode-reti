// #region imports
import * as assert from 'assert';
import * as vscode from 'vscode';
import { decodeInstruction } from '../reti/disassembler';
import { opType } from '../reti/retiStructure';
import { generateBitMask } from '../util/retiUtility';
//#endregion
suite('Disassembler Test Suite', () => {
    vscode.window.showInformationMessage('Start disassembler.ts tests.');
    // #region LOAD
    test('Testing for LOAD instructions', () => {
        let opCode = opType.LOAD << 30;
        let mode = 0b00 << 28;
        let destination = 0b11 << 24;
        let immediate = 8388608 & generateBitMask(24);
        let instruction = opCode | mode | destination | immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "LOAD ACC 8388608";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    test('Testing for LOADIN1 instructions', () => {
        let opCode = opType.LOAD << 30;
        let mode = 0b01 << 28;
        let destination = 0b10 << 24;
        let immediate = 8388608 & generateBitMask(24);
        let instruction = opCode | mode | destination | immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        // Since immediate is handled as twoc 8388608 fills all 24 bits and is evaluated as -8388608
        let expectedInstructionString = "LOADIN1 IN2 -8388608";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    test('Testing for LOADIN2 instructions with', () => {
        let opCode = opType.LOAD << 30;
        let mode = 0b10 << 28;
        let destination = 0b01 << 24;
        let immediate = 84;
        let instruction = opCode + mode + destination + immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "LOADIN2 IN1 84";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    test('Testing for LOADI', () => {
        let opCode = opType.LOAD << 30;
        let mode = 0b11 << 28;
        let destination = 0b00 << 24;
        let immediate = 18 & generateBitMask(24);
        let instruction = opCode + mode + destination + immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "LOADI PC 18";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    //#endregion
    // #region STORE
    test('Testing for STORE instructions', () => {
        let opCode = opType.STORE << 30;
        let mode = 0b00 << 28;
        let immediate = 8388608 & generateBitMask(24);
        let instruction = opCode | mode | immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        // Immediate is a register address and therefore positive
        let expectedInstructionString = "STORE 8388608";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    test('Testing for STOREIN1 instructions', () => {
        let opCode = opType.STORE << 30;
        let mode = 0b01 << 28;
        let immediate = 8388608 & generateBitMask(24);
        let instruction = opCode | mode | immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        // Again immediate is handled as twoc and therefore the negative value is expected
        let expectedInstructionString = "STOREIN1 -8388608";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    test('Testing for STOREIN2 instructions with', () => {
        let opCode = opType.STORE << 30;
        let mode = 0b10 << 28;
        let immediate = 84;
        let instruction = opCode | mode | immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "STOREIN2 84";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    test('Testing for MOVE instructions', () => {
        let opCode = opType.STORE << 30;
        let mode = 0b11 << 28;
        let source = 0b00 << 26;
        let destination = 0b01 << 24;
        let instruction = opCode | mode | source | destination;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "MOVE PC IN1";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    // #endregion
    // #region JUMP
    // Test for NOP
    test('Testing for NOP instructions', () => {
        let instruction = 0b11 << 30;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "NOP";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    // Test for JUMP
    test('Testing for JUMP instructions with negative number', () => {
        let opCode = opType.JUMP << 30;
        let condition = 0b111 << 27;
        let immediate = -18 & generateBitMask(24);
        let instruction = opCode + condition + immediate;
        let [instructionString, explanation] = decodeInstruction(instruction);
        let expectedInstructionString = "JUMP -18";
        assert.strictEqual(instructionString, expectedInstructionString);
    });
    // // Test for JUMPgt
    // test('Testing for JUMP> instructions', () => {
    //     let opCode = opType.JUMP << 30;
    //     let condition = 0b100 << 27;
    //     let immediate = 18;
    //     let instruction = opCode + condition + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "JUMP> 18";
    //     let expectedExplanation = "Bits at 31,30: 3 -> JUMP;Bit 29: 0 -> '>' is not checked & Bit 28 -> '=' is not checked & Bit 27: 0 -> '<' is not checked -> Condition = GT;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    // });
    // // Test for JUMPge
    // test('Testing for JUMP≥ instructions', () => {
    //     let opCode = opType.JUMP << 30;
    //     let condition = 0b101 << 27;
    //     let immediate = 18;
    //     let instruction = opCode + condition + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "JUMPge 18";
    //     let expectedExplanation = "Bits at 31,30: 3 -> JUMP;Bit 29: 0 -> '>' is not checked & Bit 28 -> '=' is not checked & Bit 27: 1 -> '<' is checked -> Condition = GE;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    // });
    // // Test for JUMPeq
    // test('Testing for JUMP= instructions', () => {
    //     let opCode = opType.JUMP << 30;
    //     let condition = 0b110 << 27;
    //     let immediate = 18;
    //     let instruction = opCode + condition + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "JUMP= 18";
    //     let expectedExplanation = "Bits at 31,30: 3 -> JUMP;Bit 29: 0 -> '>' is not checked & Bit 28 -> '=' is checked & Bit 27: 0 -> '<' is not checked -> Condition = EQ;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    // });
    // // Test for JUMPle
    // test('Testing for JUMP≤ instructions', () => {
    //     let opCode = opType.JUMP << 30;
    //     let condition = 0b111 << 27;
    //     let immediate = 18;
    //     let instruction = opCode + condition + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "JUMPle 18";
    //     let expectedExplanation = "Bits at 31,30: 3 -> JUMP;Bit 29: 0 -> '>' is not checked & Bit 28 -> '=' is checked & Bit 27: 1 -> '<' is checked -> Condition = LE;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    // });
    // // Test for JUMPlt
    // test('Testing for JUMP< instructions', () => {
    //     let opCode = opType.JUMP << 30;
    //     let condition = 0b000 << 27;
    //     let immediate = 18;
    //     let instruction = opCode + condition + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "JUMP< 18";
    //     let expectedExplanation = "Bits at 31,30: 3 -> JUMP;Bit 29: 1 -> '>' is checked & Bit 28 -> '=' is not checked & Bit 27: 0 -> '<' is not checked -> Condition = LT;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    // });
    // // Test for JUMPieq
    // test('Testing for JUMP≠ instructions', () => {
    //     let opCode = opType.JUMP << 30;
    //     let condition = 0b001 << 27;
    //     let immediate = 18;
    //     let instruction = opCode + condition + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "JUMPieq 18";
    //     let expectedExplanation = "Bits at 31,30: 3 -> JUMP;Bit 29: 1 -> '>' is checked & Bit 28 -> '=' is checked & Bit 27: 0 -> '<' is not checked -> Condition = IEQ;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    // });
    // // #endregion
    // // #region COMPUTE
    // test('Testing for SUB instructions', () => {
    //     let opCode = opType.COMPUTE << 30;
    //     let mode = 0b0 << 28;
    //     let functionCode = 0b010 << 26;
    //     let destination = 0b11 << 24;
    //     let immediate = 18;
    //     let instruction = opCode + mode + functionCode + destination + immediate;
    //     let [instructionString, explanation] = decodeInstruction(instruction);
    //     let expectedInstructionString = "SUBI ACC 18";
    //     let expectedExplanation = "Bits at 31,30: 0 -> COMPUTE;Bits at 29: 0 -> Mode = Compute Immediate as value;Bits at 28 to 26: 2 -> Function = SUB;Bits at 25,24: 3 -> Destination = ACC;Immediate = remaining bits 23 to 0 = 18;";
    //     assert.strictEqual(instructionString, expectedInstructionString);
    //     assert.strictEqual(explanation, expectedExplanation);
    //     immediate = -18 & generateBitMask(24);
    //     instruction = opCode | mode | functionCode | destination | immediate;
    //     [instructionString, explanation] = decodeInstruction(instruction);
    //     expectedInstructionString = "SUBI ACC -18";
    //     expectedExplanation = "Bits at 31,30: 0 -> COMPUTE;Bits at 29: 0 -> Mode = Compute Immediate as value;Bits at 28 to 26: 2 -> Function = SUB;Bits at 25,24: 3 -> Destination = ACC;Immediate = remaining bits 23 to 0 = -18;";
    // });
    // #endregion
});
//# sourceMappingURL=disassembler.test.js.map