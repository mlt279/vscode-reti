import { opType } from "./retiStructure.js";
import { generateBitMask } from "../util/retiUtility.js";
const Registers = {
    0b00: "PC",
    0b01: "IN1",
    0b10: "IN2",
    0b11: "ACC"
};
const computations = {
    0b010: "SUB",
    0b011: "ADD",
    0b100: "OPLUS",
    0b101: "OR",
    0b110: "AND"
};
const jumpConditionSymbols = {
    0b001: ">",
    0b010: "=",
    0b011: "≥",
    0b100: "<",
    0b101: "≠",
    0b110: "≤",
    0b111: ""
};
// @param instruction: The instruction to decode.
// @returns: A tuple of the instruction string and an explanation of the instruction if succesfull 
// or an error message if unsuccesful.
export function decodeInstruction(instruction) {
    let explanation = "";
    let instructionString = "";
    let type = instruction >> 30 & 0b11;
    if (type === opType.COMPUTE) {
        explanation += `Bits at 31,30: ${type.toString(2).padStart(2, '0')} -> COMPUTE;`;
        let result = decodeComputeInstruction(instruction);
        explanation += result[1];
        instructionString += result[0];
        return [instructionString, explanation];
    }
    else if (type === opType.LOAD) {
        explanation += `Bits at 31,30: ${type.toString(2).padStart(2, '0')} -> LOAD;`;
        let result = decodeLoadInstruction(instruction);
        explanation += result[1];
        instructionString += result[0];
        return [instructionString, explanation];
    }
    else if (type === opType.STORE) {
        explanation += `Bits at 31,30: ${type.toString(2).padStart(2, '0')} -> STORE;`;
        let result = decodeStoreInstruction(instruction);
        explanation += result[1];
        instructionString += result[0];
        return [instructionString, explanation];
    }
    else if (type === opType.JUMP) {
        explanation += `Bits at 31,30: ${type.toString(2).padStart(2, '0')} -> JUMP;`;
        let result = decodeJumpInstruction(instruction);
        explanation += result[1];
        instructionString += result[0];
        return [instructionString, explanation];
    }
    else {
        return ["Invalid instruction", ""];
    }
}
function decodeComputeInstruction(instruction) {
    let mi = instruction >> 29 & 0b1;
    let f = instruction >> 26 & 0b111;
    let destination = instruction >> 24 & 0b11;
    let immediate = instruction & generateBitMask(24);
    let instructionString = "";
    let explanation = "";
    instructionString += computations[f];
    if (mi === 0) {
        instructionString += "I ";
        explanation += `Bits at 29: ${mi.toString(2)} -> Mode = Compute Immediate as value;`;
        immediate = immediateAsTwoc(immediate);
    }
    else {
        instructionString += " ";
        explanation += `Bits at 29: ${mi.toString(2)} -> Mode = Compute Immediate as address;`;
    }
    explanation += `Bits at 28 to 26: ${f.toString(2).padStart(3, '0')} -> Function = ${computations[f]};`;
    instructionString += Registers[destination] + " ";
    explanation += `Bits at 25,24: ${destination.toString(2).padStart(2, '0')} -> Destination = ${Registers[destination]};`;
    instructionString += immediate.toString();
    explanation += `Remaining bits 23 to 0 = ${immediate} = immediate value;`;
    return [instructionString, explanation];
}
function decodeLoadInstruction(instruction) {
    let mode = instruction >> 28 & 0b11;
    let destination = instruction >> 24 & 0b11;
    let immediate = instruction & generateBitMask(24);
    let instructionString = "";
    let explanation = "";
    switch (mode) {
        case 0b00:
            instructionString += "LOAD ";
            explanation += `Bits at 29,28: ${mode.toString(2).padStart(2, '0')} -> Mode = LOAD; Bits at 27, 26 are ignored;`;
            break;
        case 0b11:
            instructionString += "LOADI ";
            immediate = immediateAsTwoc(immediate);
            explanation += `Bits at 29,28: ${mode.toString(2).padStart(2, '0')} -> Mode == LOADI; Bits at 27, 26 are ignored;`;
            break;
        default:
            instructionString += "LOAD" + Registers[mode] + " ";
            immediate = immediateAsTwoc(immediate);
            explanation += `Bits at 29,28: ${mode.toString(2).padStart(2, '0')} -> Mode == ${Registers[mode]} -> LOAD${Registers[mode]}; Bits at 27, 26 are ignored;`;
            break;
    }
    instructionString += Registers[destination] + " ";
    explanation += `Bits at 25,24: ${destination.toString(2).padStart(2, '0')} -> Destination = ${Registers[destination]};`;
    instructionString += immediate.toString();
    explanation += `Remaining bits 23 to 0 = ${immediate} = immediate value;`;
    return [instructionString, explanation];
}
function decodeStoreInstruction(instruction) {
    let mode = instruction >> 28 & 0b11;
    let source = instruction >> 26 & 0b11;
    let destination = instruction >> 24 & 0b11;
    let immediate = instruction & generateBitMask(24);
    let instructionString = "";
    let explanation = "";
    switch (mode) {
        case 0b00:
            instructionString += "STORE ";
            explanation += `Bits at 29,28: ${mode.toString(2).padStart(2, '0')} -> Mode = STORE; Bits at 27, 26 are ignored;`;
            break;
        case 0b11:
            instructionString = "MOVE " + Registers[source] + " ";
            explanation += `Bits at 29,28: ${mode.toString(2).padStart(2, '0')} -> Mode == MOVE; Bits at 27, 26: ${source.toString(2).padStart(2, '0')} -> SOURCE = ${Registers[source]};`;
            instructionString += Registers[destination];
            explanation += `Bits at 25,24: ${destination.toString(2).padStart(2, '0')} -> Destination = ${Registers[destination]};Immediate = remaining bits 23 to 0 = ${immediate} is ignored;`;
            return [instructionString, explanation];
        // IN1 and IN2 are handled the same.
        default:
            immediate = immediateAsTwoc(immediate);
            instructionString += "STORE" + Registers[mode] + " ";
            explanation += `Bits at 29,28: ${mode.toString(2).padStart(2, '0')} -> Mode == ${Registers[mode]} -> STORE${Registers[mode]}; Bits at 27, 26 are ignored;`;
            break;
    }
    explanation += `Bits at 25,24: ${destination.toString(2).padStart(2, '0')} -> Destination = ${Registers[destination]};`;
    instructionString += immediate.toString();
    explanation += `Remaining bits 23 to 0 = ${immediate} = immediate value;`;
    return [instructionString, explanation];
}
function decodeJumpInstruction(instruction) {
    let condition = instruction >> 27 & 0b111;
    let immediate = instruction & generateBitMask(24);
    // Handling immediate as a twoc
    immediate = immediateAsTwoc(immediate);
    let gt = condition >> 2 & 0b1;
    let eq = condition >> 1 & 0b1;
    let lt = condition & 0b1;
    let instructionString = "";
    let explanation = "";
    if (condition !== 0) {
        instructionString = "JUMP" + jumpConditionSymbols[condition] + " ";
        explanation = `Bit 29: ${gt.toString(2)} -> '>' is ${gt === 0 ? "not" : ""} checked & Bit 28: ${eq.toString(2)} -> '=' is ${eq === 0 ? "not" : ""} checked & Bit 27: ${lt.toString(2)} -> '<' is ${lt === 0 ? "not" : ""} checked -> Condition = ${jumpConditionSymbols[condition] === "" ? "ALL" : jumpConditionSymbols[condition]};`;
        instructionString += immediate.toString();
        explanation += `Remaining bits 23 to 0 = ${immediate} = immediate value;`;
    }
    else {
        instructionString = "NOP";
        explanation = "Bits at 29,28,27: 0 = All conditions are 0 and therefore none is checked -> NOP;";
    }
    return [instructionString, explanation];
}
function immediateAsTwoc(immediate) {
    if ((immediate & (1 << 23)) !== 0) {
        return immediate |= ~generateBitMask(24);
    }
    return immediate;
}
//# sourceMappingURL=disassembler.js.map