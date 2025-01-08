import { generateBitMask } from "./retiUtility";

// Function generates a random ReTI code in binary form,
// If length if given it genereates length number of instructions,
// else it will return n € {0, ..., 32} instructions.
export function randomReti(length: number | null): number[] {
    if (typeof length !== 'number') {
        length = ranFromRangeInt(1, 32);
    }
    let code: number[] = [];
    for (let i = 0; i < length; i++) {
        code.push(randomInstruction());
    }
    return code;
}

// Function generates a random ReTI instruction in binary form.
export function randomInstruction():number {
    let opCode = ranFromRangeInt(0b00, 0b11);
    switch (opCode) {
        case 0b00:
            return randomComputeInstruction();
        case 0b01:
            return randomLoadInstruction();
        case 0b10:
            return randomStoreInstruction();
        case 0b11:
            return randomJumpInstruction();
        default:
            return 0;
    }

}

// Function generates a random Compute instruction in binary form.
function randomComputeInstruction():number {
    let mi = ranFromRangeInt(0, 1);
    let f = ranFromRangeInt(0b010, 0b110);
    let register = ranFromRangeInt(0b00, 0b11);
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);
    let instruction = 0b00 << 30 | mi << 29 | f << 26 | register << 24 | immediate;
    return instruction;
}

// Function generates a random Load instruction in binary form.
function randomLoadInstruction(): number {
    let mode = ranFromRangeInt(0b00, 0b11);
    let destination = ranFromRangeInt(0b00, 0b11);
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);
    return 0b01 << 30 | mode << 28 | destination << 24 | immediate;
}

// Function generates a random Store instruction in binary form.
function randomStoreInstruction():number {
    let mode = ranFromRangeInt(0b00, 0b11);
    let source = 0;
    let destination = 0;
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);

    // This handles the special case for move instructions.
    if (mode === 0b11) { 
        source = ranFromRangeInt(0b00, 0b11); 
        destination = ranFromRangeInt(0b00, 0b11);
        immediate = 0;
    }
    return 0b10 << 30 | mode << 28 | source << 26 | destination << 24 | immediate;
}

// Function generates a random Jump instruction in binary form.
function randomJumpInstruction():number {
    let condition = ranFromRangeInt(0b000, 0b111);
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);

    // This handles the special case for NOP instructions.
    if (condition === 0b000) {
        immediate = 0;
    }
    return 0b11 << 30 | condition << 27 | immediate;
}

// Function generates a random number between min and max.
export function ranFromRange(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// Function generates a random integer number between min and max.
export function ranFromRangeInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}