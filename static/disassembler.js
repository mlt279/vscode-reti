import { opType } from "./retiStructure.js";
import { generateBitMask } from "./retiUtility.js";
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
    let type = instruction >> 30 & 0b11;
    if (type === opType.COMPUTE) {
        return decodeComputeInstruction(instruction);
    }
    else if (type === opType.LOAD) {
        return decodeLoadInstruction(instruction);
    }
    else if (type === opType.STORE) {
        return decodeStoreInstruction(instruction);
    }
    else if (type === opType.JUMP) {
        return decodeJumpInstruction(instruction);
    }
    else {
        return ["Invalid instruction", []];
    }
}
function decodeComputeInstruction(instruction) {
    let explanationList = [];
    explanationList[0] = ["Type", 2, "COMPUTE"];
    let mi = instruction >> 29 & 0b1;
    let f = instruction >> 26 & 0b111;
    let destination = instruction >> 24 & 0b11;
    let immediate = instruction & generateBitMask(24);
    let instructionString = "";
    instructionString += computations[f];
    explanationList[2] = ["Function", 3, computations[f]];
    if (mi === 0) {
        instructionString += "I ";
        explanationList[1] = ["MI", 1, "I"];
        immediate = immediateAsTwoc(immediate);
    }
    else {
        instructionString += " ";
        explanationList[1] = ["MI", 1, ""];
    }
    instructionString += Registers[destination] + " ";
    explanationList[3] = ["Destination", 2, Registers[destination]];
    instructionString += immediate.toString();
    explanationList[4] = ["Immediate", 24, immediate.toString()];
    return [instructionString, explanationList];
}
function decodeLoadInstruction(instruction) {
    let explanationList = [];
    explanationList[0] = ["Type", 2, "LOAD"];
    explanationList[2] = ["*", 2, ""];
    let mode = instruction >> 28 & 0b11;
    let destination = instruction >> 24 & 0b11;
    let immediate = instruction & generateBitMask(24);
    let instructionString = "";
    switch (mode) {
        case 0b00:
            instructionString += "LOAD ";
            explanationList[1] = ["Mode", 2, ""];
            break;
        case 0b11:
            instructionString += "LOADI ";
            immediate = immediateAsTwoc(immediate);
            explanationList[1] = ["Mode", 2, "I"];
            break;
        default:
            instructionString += "LOAD" + Registers[mode] + " ";
            immediate = immediateAsTwoc(immediate);
            explanationList[1] = ["Mode", 2, Registers[mode]];
            break;
    }
    instructionString += Registers[destination] + " ";
    explanationList[3] = ["Destination", 2, Registers[destination]];
    instructionString += immediate.toString();
    explanationList[4] = ["Immediate", 24, immediate.toString()];
    return [instructionString, explanationList];
}
function decodeStoreInstruction(instruction) {
    let explanationList = [];
    explanationList[0] = ["Type", 2, "STORE"];
    let mode = instruction >> 28 & 0b11;
    let source = instruction >> 26 & 0b11;
    let destination = instruction >> 24 & 0b11;
    let immediate = instruction & generateBitMask(24);
    let instructionString = "";
    switch (mode) {
        case 0b00:
            instructionString += "STORE ";
            explanationList[1] = ["Mode", 2, ""];
            break;
        case 0b11:
            instructionString = "MOVE " + Registers[source] + " ";
            explanationList[1] = ["Mode", 2, "MOVE"];
            explanationList[2] = ["Source", 2, Registers[source]];
            explanationList[3] = ["Destination", 2, Registers[destination]];
            explanationList[4] = ["*", 24, ""];
            instructionString += Registers[destination];
            return [instructionString, explanationList];
        // IN1 and IN2 are handled the same.
        default:
            immediate = immediateAsTwoc(immediate);
            instructionString += "STORE" + Registers[mode] + " ";
            explanationList[1] = ["Mode", 2, Registers[mode]];
            break;
    }
    explanationList[2] = ["*", 2, ""];
    explanationList[3] = ["*", 2, ""];
    instructionString += immediate.toString();
    explanationList[4] = ["Immediate", 24, immediate.toString()];
    return [instructionString, explanationList];
}
function decodeJumpInstruction(instruction) {
    let explanationList = [];
    explanationList[0] = ["Type", 2, "JUMP"];
    explanationList[2] = ["*", 3, ""];
    let condition = instruction >> 27 & 0b111;
    let immediate = instruction & generateBitMask(24);
    // Handling immediate as a twoc
    immediate = immediateAsTwoc(immediate);
    explanationList[3] = ["Immediate", 24, immediate.toString()];
    // Not needed for know. Later on this ideally could be used to better explain how the jump conditions work.
    // let gt = condition >> 2 & 0b1;
    // let eq = condition >> 1 & 0b1;
    // let lt = condition & 0b1;
    let instructionString = "";
    let explanation = "";
    if (condition !== 0) {
        instructionString = "JUMP" + jumpConditionSymbols[condition] + " ";
        explanationList[1] = ["Condition", 3, jumpConditionSymbols[condition]];
        instructionString += immediate.toString();
        explanation += `Remaining bits 23 to 0 = ${immediate} = immediate value;`;
    }
    else {
        instructionString = "NOP";
        explanationList[1] = ["Condition", 3, "NOP"];
    }
    return [instructionString, explanationList];
}
function immediateAsTwoc(immediate) {
    if ((immediate & (1 << 23)) !== 0) {
        return immediate |= ~generateBitMask(24);
    }
    return immediate;
}
//# sourceMappingURL=disassembler.js.map