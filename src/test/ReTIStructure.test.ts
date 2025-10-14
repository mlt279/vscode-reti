import * as assert from 'assert';
import * as vscode from 'vscode';
import { registerCode, ReTI } from '../reti/ti/retiStructure_ti';
import { generateBitMask } from '../util/retiUtility';

suite ('ReTIStructure Test Suite', async () => {
    vscode.window.showInformationMessage('Start all ReTIStructure tests.');

    
    let reti = new ReTI([generateBitMask(32), 0b1111_1100 | generateBitMask(24)], [0]);
    test ("Create a ReTIStructure object", async () => {
        let expectedData = "Registers\nPC: 0\nIN1: 0\nIN2: 0\nACC: 0\nData\nCode\n";
        assert.notStrictEqual(reti.dumpState(), expectedData);
    });

    test ("Get code", async () => {
        assert.strictEqual(reti.getCode(0), generateBitMask(32));
        let expectedData = 0b1111_1100 | generateBitMask(24);
        assert.strictEqual(reti.getCode(1), expectedData);
        assert.strictEqual(reti.getCode(2), 0);
    });

    test ("Set and get data", async () => {
        assert.strictEqual(reti.getData(487), 0);
        reti.setData(0, 0b110);
        reti.setData(22, 0b110);
        let expectedData = 0b110;
        assert.strictEqual(reti.getData(0), expectedData);
        assert.strictEqual(reti.getData(22), expectedData);
        // Testing wether adresses between the two cells have been initialized
        for (let i = 1; i < 22; i++) {
            expectedData = 0;
            assert.strictEqual(reti.getData(i), expectedData);
        }
    });

    test("Get register", async () => {
        let expectedData = 0;
        assert.strictEqual(reti.getRegister(0), expectedData);
        reti.setRegister(registerCode.PC, 0b110);
        reti.setRegister(registerCode.IN1, 0);
        reti.setRegister(registerCode.IN2, 2);
        reti.setRegister(registerCode.ACC, 1);
        expectedData = 6;
        assert.strictEqual(reti.getRegister(registerCode.PC), expectedData);
        expectedData = 0;
        assert.strictEqual(reti.getRegister(registerCode.IN1), expectedData);
        expectedData = 2;
        assert.strictEqual(reti.getRegister(registerCode.IN2), expectedData);
        expectedData = 1;
        assert.strictEqual(reti.getRegister(registerCode.ACC), expectedData);
    });

    test("Test get non zero data" , async () => {
        reti = new ReTI([generateBitMask(32), 0b1111_1100 | generateBitMask(24)], [0]);

        reti.setData(42, 42);
        reti.setData(1, 22);
        let expectedData: Map<number, number> = new Map<number, number>();
        expectedData.set(0, generateBitMask(32));
        expectedData.set(1, 0b1111_1100 | generateBitMask(24));
        expectedData.set(2, 22);
        expectedData.set(42, 42);
        let data = reti.getNonZeroData();
    });
});