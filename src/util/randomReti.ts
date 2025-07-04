import { generateBitMask } from "./retiUtility.js";

// Function generates a random ReTI code in binary form,
// If length if given it genereates length number of instructions,
// else it will return n € {0, ..., 32} instructions.
export function randomReti(length: number | null, bitSizeImmediate: number): number[] {
    if (typeof length !== 'number') {
        length = ranFromRangeInt(1, 32);
    }
    if (typeof bitSizeImmediate !== 'number') {
        bitSizeImmediate = 24; // Default to 24 bits if not specified
    }
    let code: number[] = [];
    for (let i = 0; i < length; i++) {
        code.push(randomInstruction(bitSizeImmediate));
    }
    return code;
}

// Function generates a random ReTI instruction in binary form.
// Takes the size of the immediate value in bits as an optional parameter.
export function randomInstruction(bitSizeImmediate: number):number {
    let opCode = ranFromRangeInt(0b00, 0b11);
    switch (opCode) {
        case 0b00:
            return randomComputeInstruction(bitSizeImmediate);
        case 0b01:
            return randomLoadInstruction(bitSizeImmediate);
        case 0b10:
            return randomStoreInstruction(bitSizeImmediate);
        case 0b11:
            return randomJumpInstruction(bitSizeImmediate);
        default:
            return 0;
    }

}

// Function generates a random Compute instruction in binary form.
function randomComputeInstruction(bitSizeImmediate: number):number {
    if (typeof bitSizeImmediate !== 'number') {
        bitSizeImmediate = 24; // Default to 24 bits if not specified
    }
    let mi = ranFromRangeInt(0, 1);
    let f = ranFromRangeInt(0b010, 0b110);
    let register = ranFromRangeInt(0b00, 0b11);
    let immediate = ranFromRangeInt(0, generateBitMask(bitSizeImmediate)) & generateBitMask(24);
    let instruction = 0b00 << 30 | mi << 29 | f << 26 | register << 24 | immediate;
    return instruction;
}

// Function generates a random Load instruction in binary form.
function randomLoadInstruction(bitSizeImmediate: number): number {
    if (typeof bitSizeImmediate !== 'number' || bitSizeImmediate < 0 || bitSizeImmediate > 24) {
        bitSizeImmediate = 24; // Default to 24 bits if not specified
    }
    let mode = ranFromRangeInt(0b00, 0b11);
    let destination = ranFromRangeInt(0b00, 0b11);
    let immediate = ranFromRangeInt(0, generateBitMask(bitSizeImmediate)) & generateBitMask(24);
    return 0b01 << 30 | mode << 28 | destination << 24 | immediate;
}

// Function generates a random Store instruction in binary form.
function randomStoreInstruction(bitSizeImmediate: number):number {
    if (typeof bitSizeImmediate !== 'number') {
        bitSizeImmediate = 24; // Default to 24 bits if not specified
    }
    let mode = ranFromRangeInt(0b00, 0b11);
    let source = 0;
    let destination = 0;
    let immediate = ranFromRangeInt(0, generateBitMask(bitSizeImmediate)) & generateBitMask(24);

    // This handles the special case for move instructions.
    if (mode === 0b11) { 
        source = ranFromRangeInt(0b00, 0b11); 
        destination = ranFromRangeInt(0b00, 0b11);
        immediate = 0;
    }
    return 0b10 << 30 | mode << 28 | source << 26 | destination << 24 | immediate;
}

// Function generates a random Jump instruction in binary form.
function randomJumpInstruction(bitSizeImmediate: number):number {
    if (typeof bitSizeImmediate !== 'number') {
        bitSizeImmediate = 24; // Default to 24 bits if not specified
    }
    let condition = ranFromRangeInt(0b000, 0b111);
    let immediate = ranFromRangeInt(0, generateBitMask(bitSizeImmediate)) & generateBitMask(24);

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