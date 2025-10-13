//#region imports

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Emulator } from '../reti/ti/emulator_ti';
import { assembleLine } from '../reti/ti/assembler_ti';
import { registerCode, ReTI } from '../reti/ti/retiStructure_ti';

//#endregion

suite('Emulator Test Suite', async () => {
    vscode.window.showInformationMessage('Start all emulator tests.');

    test('Testing jump instruction.', async () => {
        let instruction = assembleLine(["JUMP", "2"]);
        // instruction[0] is the error code.
        assert.equal(instruction[0], 0);
        let instruction2 = assembleLine(["JUMP<", "69"]);
        assert.equal(instruction2[0], 0);
        let instruction3 = assembleLine(["JUMP>", "50"]);
        assert.equal(instruction3[0], 0);
        let instruction4 = assembleLine(["JUMP=", "-2"]);
        assert.equal(instruction4[0], 0);
        let code = [instruction[1], instruction2[1], instruction3[1], instruction4[1]];
        let emulator = new Emulator(code, [0, 1, 2, 3, 4, 5, 6, 7], vscode.window.createOutputChannel("Emulator"));
        

        assert.equal(emulator.getRegister(registerCode.PC), 0);
        // Execute JUMP 2, PC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 2);

        // Execute JUMP> 50, PC = 3
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 3);

        // Execute JUMP= -2, PC = 1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 1);

        // Execute JUMP< 69, PC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 2);
    });

    test('Testing conditional jump instruction.', async () => {

        // #region create instructions
        let instructions: number[] = [];
        // LOADI ACC 2 | 1, 20
        let assemble = assembleLine(["LOADI", "ACC", "2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);
        // JUMP 2 | 2
        assemble = assembleLine(["JUMP", "3"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);
        // LOADI ACC 0 | 4
        assemble = assembleLine(["LOADI", "ACC", "0"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);
        // JUMP= 2 | 5
        assemble = assembleLine(["JUMP=", "2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);
        // JUMP> -2 | 3
        assemble = assembleLine(["JUMP>", "-2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);
        // LOADI ACC -1 | 6
        assemble = assembleLine(["LOADI", "ACC", "-1"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP< 2 | 7
        assemble = assembleLine(["JUMP<", "2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // LOADI ACC 22 | 9
        assemble = assembleLine(["LOADI", "ACC", "22"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP<= -1 | 8, 10
        assemble = assembleLine(["JUMP<=", "-1"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP>= 2 | 11
        assemble = assembleLine(["JUMP>=", "2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP 3 | 14
        assemble = assembleLine(["JUMP", "3"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // LOADI ACC 0| 12
        assemble = assembleLine(["LOADI", "ACC", "0"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP>= -2 | 13
        assemble = assembleLine(["JUMP>=", "-2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // NOP | 15
        assemble = assembleLine(["NOP"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP>= 2 |16
        assemble = assembleLine(["JUMP>=", "2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP -15 | 19
        assemble = assembleLine(["JUMP", "-15"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // LOADI ACC 0 | 17
        assemble = assembleLine(["LOADI", "ACC", "0"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);

        // JUMP>= -2 |18
        assemble = assembleLine(["JUMP>=", "-2"]);
        assert.equal(assemble[0], 0);
        instructions.push(assemble[1]);
        //#endregion

        let emulator = new Emulator(instructions, [0], vscode.window.createOutputChannel("Emulator"));

        assert.equal(emulator.getRegister(registerCode.PC), 0);
        // LOADI ACC 2
        // Expected: ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 1);
        assert.equal(emulator.getRegister(registerCode.ACC), 2);

        // JUMP 3
        // Expected: PC = 1 + 3
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 4);

        // JUMP> -2
        // Expected: PC = 4 - 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 2);

        // LOADI ACC 0
        // Expected: ACC = 0
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 3);
        assert.equal(emulator.getRegister(registerCode.ACC), 0);

        // JUMP= 2
        // Expected: PC = 3 + 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 5);
        
        // LOADI ACC -1
        // Expected: ACC = -1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 6);

        // JUMP< 2
        // Expected: PC = 6 + 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 8);

        // JUMP<= -1
        // Expected: PC = 8 - 1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 7);

        // LOADI ACC 22
        // Expected: ACC = 22
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 8);
        assert.equal(emulator.getRegister(registerCode.ACC), 22);

        // JUMP<= -1
        // Expected: PC = 8 + 1 (Don't execute JUMP)
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 9);

        // JUMP>= 2
        // Expected: PC = 9 + 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 11);

        // LOADI ACC 0
        // Expected: ACC = 0
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 12);
        assert.equal(emulator.getRegister(registerCode.ACC), 0);

        // JUMP>= -2
        // Expected: PC = 12 - 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 10);

        // JUMP 3
        // Expected: PC = 10 + 3
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 13);

        // NOP
        // Expected: PC = 13 + 1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 14);

        // JUMP>= 2
        // Expected: PC = 14 + 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 16);

        // LOADI ACC 0
        // Expected: ACC = 0
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 17);
        assert.equal(emulator.getRegister(registerCode.ACC), 0);

        //______________________________________________________
        // JUMP>= -2
        // Expected: PC = 17 - 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 15);

        // JUMP -15
        // Expected: PC = 15 - 15
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 0);
    });

    test('Testing load instruction.', async () => {
        let instruction = assembleLine(["LOAD", "IN1", "1"])[1]; // IN1 = 1
        let instruction1 = assembleLine(["LOADIN1", "IN2", "2"])[1]; // IN2 = 3
        let instruction2 = assembleLine(["LOADI", "ACC", "69"])[1];     // ACC = 69
        let instruction3 = assembleLine(["LOADIN2", "ACC", "4"])[1];    // ACC = 7
        let code = [instruction, instruction1, instruction2, instruction3];
        let emulator = new Emulator(code, [0, 1, 2, 3, 4, 5, 6, 7], vscode.window.createOutputChannel("Emulator"));
        assert.equal(emulator.getRegister(registerCode.IN1), 0);
        assert.equal(emulator.getRegister(registerCode.IN2), 0);
        assert.equal(emulator.getRegister(registerCode.ACC), 0);
        assert.equal(emulator.getRegister(registerCode.PC), 0);
        for (let i = 0; i < 8; i++) {
            assert.equal(emulator.getData(i), i);    
        }
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.IN1), 1);
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.IN2), 3);
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.ACC), 69);
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.ACC), 7);
    });

    test('Testing store instruction.', async () => {
        let instruction = assembleLine(["LOADI", "ACC", "2"])[1]; // ACC = 2
        let instruction1 = assembleLine(["STORE", "1"])[1]; // M<1> = 2
        let instruction2 = assembleLine(["MOVE", "ACC", "IN1"])[1]; // IN1 = 2
        let instruction3 = assembleLine(["STOREIN1", "1"])[1]; // M<3> = 2
        let instruction4 = assembleLine(["Move", "ACC", "IN2"])[1]; // IN2 = 2
        let instruction5 = assembleLine(["STOREIN2", "2"])[1]; // M<4> = 2
        let code = [instruction, instruction1, instruction2, instruction3, instruction4, instruction5];

        let emulator = new Emulator(code, [0, 1, 2, 3, 4, 5, 6, 7], vscode.window.createOutputChannel("Emulator"));
        assert.equal(emulator.getRegister(registerCode.IN1), 0);
        assert.equal(emulator.getRegister(registerCode.IN2), 0);
        assert.equal(emulator.getRegister(registerCode.ACC), 0);
        assert.equal(emulator.getRegister(registerCode.PC), 0);
        for (let i = 0; i < 8; i++) {
            assert.equal(emulator.getData(i), i);    
        }
        // LOADI ACC 2
        // Expected: ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 1);
        assert.equal(emulator.getRegister(registerCode.ACC), 2);

        // STORE 1
        // Expected: M<1> = ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 2);
        assert.equal(emulator.getData(1), 2);

        // MOVE ACC IN1
        // Expected: IN1 = ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 3);
        assert.equal(emulator.getRegister(registerCode.IN1), 2);

        // STOREIN1 1
        // Expected: M<IN1 + 1> = M<3> = ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 4);
        assert.equal(emulator.getData(3), 2);

        // MOVE ACC IN2
        // Expected: IN2 = ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 5);
        assert.equal(emulator.getRegister(registerCode.IN2), 2);

        // STOREIN2 2
        // Expected: M<IN2 + 2> = M<4> = ACC = 2
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 6);
        assert.equal(emulator.getData(4), 2);
    });

    test ('Testing compute instruction.', async () => {
        let instruction1 = assembleLine(["LOADI", "ACC", "1"])[1]; // ACC = 2

        // SUBI
        let subi = assembleLine(["SUBI", "ACC", "2"])[1]; // ACC = -1

        // ADDI
        let addi = assembleLine(["ADDI", "ACC", "2"])[1]; // ACC = 1

        // OPLUSI
        let oplusi = assembleLine(["OPLUSI", "ACC", "2"])[1]; // ACC = 3

        // ORI
        let ori = assembleLine(["ORI", "ACC", "5"])[1]; // ACC = 0b111 (7)

        // ANDI
        let andi = assembleLine(["ANDI", "ACC", "1"])[1]; // ACC = 1
        let andi2 = assembleLine(["ANDI", "IN1", "2"])[1]; // IN1 = 0

        // SUB
        let sub = assembleLine(["SUB", "IN1", "1"])[1]; // IN1 = -M<ACC> = -M<1> = -1

        // ADD
        let add = assembleLine(["ADD", "IN1", "5"])[1]; // IN1 = IN1 + M<5> = -1 + 5 = 4

        // OPLUS
        let oplus = assembleLine(["OPLUS", "ACC", "7"])[1]; // ACC = 7 xor 1 = 6

        // OR
        let or = assembleLine(["OR", "ACC", "8"])[1]; // ACC = 7 (because M<8> = 1)

        // AND
        let and = assembleLine(["AND", "ACC", "8"])[1]; // ACC = 1

        let code = [instruction1, subi, addi, oplusi, ori, andi, andi2, sub, add, oplus, or, and];
        let emulator = new Emulator(code, [0, 1, 2, 3, 4, 5, 6, 7, 1], vscode.window.createOutputChannel("Emulator"));

        assert.equal(emulator.getRegister(registerCode.IN1), 0);
        assert.equal(emulator.getRegister(registerCode.IN2), 0);
        assert.equal(emulator.getRegister(registerCode.ACC), 0);
        assert.equal(emulator.getRegister(registerCode.PC), 0);

        for (let i = 0; i < 7; i++) {
            assert.equal(emulator.getData(i), i);    
        }
        assert.equal(emulator.getData(8), 1);

        // LOADI ACC 1
        // Expected: ACC = 1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 1);
        assert.equal(emulator.getRegister(registerCode.ACC), 1);

        // SUBI ACC 2
        // Expected: ACC = -1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 2);
        assert.equal(emulator.getRegister(registerCode.ACC), -1);

        // ADDI ACC 2
        // Expected: ACC = 1
        assert.equal(emulator.getCurrentInstruction(), addi);
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 3);
        assert.equal(emulator.getRegister(registerCode.ACC), 1);

        // OPLUSI ACC 2
        // Expected: ACC = 3
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 4);
        assert.equal(emulator.getRegister(registerCode.ACC), 3);

        // ORI ACC 5
        // Expected: ACC = 7
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 5);
        assert.equal(emulator.getRegister(registerCode.ACC), 7);

        // ANDI ACC 1
        // Expected: ACC = 1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 6);
        assert.equal(emulator.getRegister(registerCode.ACC), 1);

        // ANDI IN1 2
        // Expected: IN1 = 0
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 7);
        assert.equal(emulator.getRegister(registerCode.IN1), 0);

        // SUB IN1 1
        // Expected: IN1 = -1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 8);
        assert.equal(emulator.getRegister(registerCode.IN1), -1);

        // ADD IN1 5
        // Expected: IN1 = 4
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 9);
        assert.equal(emulator.getRegister(registerCode.IN1), 4);

        // OPLUS ACC 7
        // Expected: ACC = 6
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 10);
        assert.equal(emulator.getRegister(registerCode.ACC), 6);

        // OR ACC 8
        // Expected: ACC = 7
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 11);
        assert.equal(emulator.getRegister(registerCode.ACC), 7);

        // AND ACC 8
        // Expected: ACC = 1
        emulator.step();
        assert.equal(emulator.getRegister(registerCode.PC), 12);

    });

});