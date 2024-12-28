import * as assert from 'assert';
import * as vscode from 'vscode';
import { binToHex, generateBitMask, hexToBin } from '../reti/retiUtility';
import { get } from 'http';

suite('retiUtility Test Suite', async () => {
    vscode.window.showInformationMessage('Start all ReTIStructure tests.');

    test('Test generateBitMask()', async () => {
        for (let i = 0; i < 31; i++) {
            let expectedData = (2**i);
            assert.strictEqual(generateBitMask(i), expectedData - 1);
        }
    });
    
    test('Test binToHex()', async () => {
        let hex = binToHex(0b0111_0011_0000_0000_0000_0000_0000_0001);
        assert.strictEqual(hex, '73000001');
        hex = binToHex("0111 0011 0000 0000 0000 0000 0000 0001");
        assert.strictEqual(hex, '73000001');

        hex = binToHex(0b1100_0000_0000_0000_0000_0000_0000_0000);
        assert.strictEqual(hex, 'c0000000');
        hex = binToHex("1100 0000 0000 0000 0000 0000 0000 0000");
        assert.strictEqual(hex, 'c0000000');

        hex = binToHex(0b0000_0000_0000_0000_0000_0000_0000_0000);
        assert.strictEqual(hex, '00000000');
        hex = binToHex("0000 0000 0000 0000 0000 0000 0000 0000");
        assert.strictEqual(hex, '00000000');

        hex = binToHex(0b1111_1111_1111_1111_1111_1111_1111_1111);
        assert.strictEqual(hex, 'ffffffff');
        hex = binToHex("1111 1111 1111 1111 1111 1111 1111 1111");
        assert.strictEqual(hex, 'ffffffff');

        hex = binToHex(0b0000_1111_0000_0000_0000_0000_0000_0001);
        assert.strictEqual(hex, '0f000001');
        hex = binToHex("0000 1111 0000 0000 0000 0000 0000 0001");
        assert.strictEqual(hex, '0f000001');

        hex = binToHex(0b1000_0000_0000_0000_0000_0000_0000_0011);
        assert.strictEqual(hex, '80000003');
        hex = binToHex("1000 0000 0000 0000 0000 0000 0000 0011");
        assert.strictEqual(hex, '80000003');
    });

    test("Testing hexToBin()", async () => {
        for (let i = 0; i < 32; i++) {
            let number = 2**i;
            let hex = binToHex(number);
            let bin = hexToBin(hex);
            assert.strictEqual(bin, number.toString(2).padStart(32, '0'));
        }
    });
});