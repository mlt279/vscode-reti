// This only works up to 32 bits (so 0-31) since bitwise operations in JS are 32 bit.
export function generateBitMask(length) {
    if (length < 0 || length > 32) {
        return -1;
    }
    if (length === 32) {
        return 0xfffffff;
    }
    return (1 << length) - 1;
}
// Takes binary number either as number value or as string with spaces and underscores.
// Returns the hex string (only positive) of each for bits as hex.
export function binToHex(bin) {
    let hexString = "";
    if (typeof bin === 'string') {
        bin = bin.split(' ').join('');
        bin = bin.replace('_', '');
        bin = parseInt(bin, 2);
    }
    for (let i = 7; i >= 0; i--) {
        let hex = bin >> i * 4 & 0b1111;
        hexString += hex.toString(16);
    }
    return hexString;
}
// Takes a hex string and returns the 32 bit binary string.
export function hexToBin(hex) {
    return parseInt(hex, 16).toString(2).padStart(32, '0');
}
// Makes sure the immediate is handled as a Twoc by extending the signed bit to 32 bits if negative.
export function immediateAsTwoc(immediate, size = 24) {
    if ((immediate & (1 << (size - 1))) !== 0) {
        return immediate | 0xff000000;
    }
    return immediate;
}
// Ensures the immediate is handled as an unsigned number.
export function immediateUnsigned(immediate) {
    return immediate >>> 0;
}
//# sourceMappingURL=retiUtility.js.map

const chunkSize = 2 ** 16;
export var opType;
(function (opType) {
    opType[opType["COMPUTE"] = 0] = "COMPUTE";
    opType[opType["LOAD"] = 1] = "LOAD";
    opType[opType["STORE"] = 2] = "STORE";
    opType[opType["JUMP"] = 3] = "JUMP";
})(opType || (opType = {}));
export var registerCode;
(function (registerCode) {
    registerCode[registerCode["PC"] = 0] = "PC";
    registerCode[registerCode["IN1"] = 1] = "IN1";
    registerCode[registerCode["IN2"] = 2] = "IN2";
    registerCode[registerCode["ACC"] = 3] = "ACC";
})(registerCode || (registerCode = {}));
export var conditionCode;
(function (conditionCode) {
    conditionCode[conditionCode["LESS"] = 1] = "LESS";
    conditionCode[conditionCode["EQUAL"] = 2] = "EQUAL";
    conditionCode[conditionCode["GREATER"] = 4] = "GREATER";
})(conditionCode || (conditionCode = {}));
export var computeCode;
(function (computeCode) {
    computeCode[computeCode["SUB"] = 2] = "SUB";
    computeCode[computeCode["ADD"] = 3] = "ADD";
    computeCode[computeCode["OPLUS"] = 4] = "OPLUS";
    computeCode[computeCode["OR"] = 5] = "OR";
    computeCode[computeCode["AND"] = 6] = "AND";
})(computeCode || (computeCode = {}));
export function stateToString(state) {
    let result = "";
    result += "Registers:\n";
    result += `PC: ${state.registers[0]}\n`;
    result += `IN1: ${state.registers[1]}\n`;
    result += `IN2: ${state.registers[2]}\n`;
    result += `ACC: ${state.registers[3]}\n`;
    result += "\nData:\n";
    for (let [address, data] of state.data) {
        result += `${address}: ${binToHex(data)}\n`;
    }
    return result;
}
export class ReTI {
    // Memory is stored in chunks of size specified in chunkSize in the constructor.
    memory;
    registers;
    shadow;
    constructor(code, data) {
        this.memory = new Map();
        this.shadow = { memory: [], codeSize: code.length };
        this.registers = new Array(4).fill(0);
        this.memory.set(0, code);
        this.shadow.memory[0] = true;
        if (data.length <= chunkSize) {
            this.memory.set(1, [...data, ...new Array(chunkSize - data.length).fill(0)]);
            this.shadow.memory.push(true);
        }
        else {
            let i = 1;
            while (data.length > 0) {
                this.memory.set(i, data.splice(0, chunkSize));
                i++;
                this.shadow.memory.push(true);
            }
        }
    }
    // Sets the data memory to the given data.
    setMemory(data) {
        // Resetting memory except code.
        this.shadow.memory = [false];
        for (let key of this.memory.keys()) {
            if (key !== 0) {
                this.memory.delete(key);
            }
        }
        // Setting the new data.
        if (data.length <= chunkSize) {
            this.memory.set(1, [...data, ...new Array(chunkSize - data.length).fill(0)]);
            this.shadow.memory[1] = true;
        }
        else {
            let i = 1;
            while (data.length > 0) {
                this.memory.set(i, data.splice(0, chunkSize));
                i++;
                this.shadow.memory.push(true);
            }
        }
    }
    // TODO: Do I continue to handle 0 as 0 + codeSize or do I throw an error?
    // Give an adress and a value both as number to write the value of the word to the data memory.
    setData(address, data) {
        // TODO: If I don't want to handle 0 as 0 + codeSize, I have to remove the - this.shadow.codeSize
        if (address >= 2 ** 32 - this.shadow.codeSize || this.shadow.memory[Math.floor(address / chunkSize)] === false) {
            return 1;
        }
        let memoryChunk = this.memory.get(Math.floor(address / chunkSize) + 1);
        // This will initialize a new chunk of memory if nothing has been stored at the address yet.
        if (this.shadow.memory[Math.floor(address / chunkSize) + 1] === undefined || memoryChunk === undefined) {
            this.memory.set(Math.floor(address / chunkSize) + 1, new Array(chunkSize).fill(0));
            this.shadow.memory[Math.floor(address / chunkSize) + 1] = true;
            memoryChunk = this.memory.get(Math.floor(address / chunkSize) + 1);
        }
        // True means the address is a writable data cell (not code).
        if (this.shadow.memory[Math.floor(address / chunkSize) + 1] === true) {
            if (memoryChunk === undefined) {
                return 1;
            }
            memoryChunk[address % chunkSize] = data;
        }
        return 0;
    }
    // Returns the word stored add the given adress as a number.
    getCode(address) {
        if (address >= this.shadow.codeSize) {
            return 0;
        }
        let code = this.memory.get(0);
        if (code === undefined) {
            return 0;
        }
        return code[address];
    }
    // Returns the word stored at the given adress as a number.
    getData(address) {
        if (address >= Math.min(this.shadow.memory.length * chunkSize, 2 ** 32)) {
            return 0;
        }
        let memoryChunk = this.memory.get(Math.floor(address / chunkSize) + 1);
        if (memoryChunk === undefined) {
            return 0;
        }
        return memoryChunk[address % chunkSize] === undefined ? 0 : memoryChunk[address % chunkSize];
    }
    // Returns the value of the register.
    // Use the registerCode enum to get the register.
    getRegister(register) {
        if (register === registerCode.PC) {
            return immediateUnsigned(this.registers[register]);
        }
        return immediateAsTwoc(this.registers[register]);
    }
    // Sets the value of the register.
    // Use the registerCode enum to set the register.
    setRegister(register, value) {
        this.registers[register] = value & generateBitMask(32);
    }
    // For debugging purposes. Returns the state of the ReTI (registers, data and code) as a string.
    dumpState() {
        let state = "";
        state += "Registers:\n";
        state += `PC: ${this.getRegister(registerCode.PC)}\n`;
        state += `IN1: ${this.getRegister(registerCode.IN1)}\n`;
        state += `IN2: ${this.getRegister(registerCode.IN2)}\n`;
        state += `ACC: ${this.getRegister(registerCode.ACC)}\n`;
        state += "\nCode:\n";
        for (let i = 0; i < this.shadow.codeSize; i++) {
            state += `${i}: ${binToHex(this.getCode(i))}\n`;
        }
        state += "\nData:\n";
        for (let [address, data] of this.getNoneZeroData()) {
            if (address < this.shadow.codeSize) {
                continue;
            }
            state += `${address}: ${binToHex(data)}\n`;
        }
        return state;
    }
    getRealAdress(chunkKey, arrayIndex) {
        return (chunkKey - 1) * chunkSize + arrayIndex + this.shadow.codeSize;
    }
    getNoneZeroData() {
        let current_address = 0;
        let noneZero = new Map();
        this.memory.forEach((element, chunkKey) => {
            for (let i = 0; i < element.length; i++) {
                current_address = chunkKey === 0 ? i : this.getRealAdress(chunkKey, i);
                if (element[i] !== 0) {
                    noneZero.set(current_address, element[i]);
                }
            }
        });
        return noneZero;
    }
    exportState() {
        return { registers: [...this.registers], data: this.getNoneZeroData(), endCondition: "" };
    }
}
//# sourceMappingURL=retiStructure.js.map

// Function generates a random ReTI code in binary form,
// If length if given it genereates length number of instructions,
// else it will return n € {0, ..., 32} instructions.
export function randomReti(length) {
    if (typeof length !== 'number') {
        length = ranFromRangeInt(1, 32);
    }
    let code = [];
    for (let i = 0; i < length; i++) {
        code.push(randomInstruction());
    }
    return code;
}
// Function generates a random ReTI instruction in binary form.
export function randomInstruction() {
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
function randomComputeInstruction() {
    let mi = ranFromRangeInt(0, 1);
    let f = ranFromRangeInt(0b010, 0b110);
    let register = ranFromRangeInt(0b00, 0b11);
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);
    let instruction = 0b00 << 30 | mi << 29 | f << 26 | register << 24 | immediate;
    return instruction;
}
// Function generates a random Load instruction in binary form.
function randomLoadInstruction() {
    let mode = ranFromRangeInt(0b00, 0b11);
    let destination = ranFromRangeInt(0b00, 0b11);
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);
    return 0b01 << 30 | mode << 28 | destination << 24 | immediate;
}
// Function generates a random Store instruction in binary form.
function randomStoreInstruction() {
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
function randomJumpInstruction() {
    let condition = ranFromRangeInt(0b000, 0b111);
    let immediate = ranFromRangeInt(0, generateBitMask(24)) & generateBitMask(24);
    // This handles the special case for NOP instructions.
    if (condition === 0b000) {
        immediate = 0;
    }
    return 0b11 << 30 | condition << 27 | immediate;
}
// Function generates a random number between min and max.
export function ranFromRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
// Function generates a random integer number between min and max.
export function ranFromRangeInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
//# sourceMappingURL=randomReti.js.map
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
//# sourceMappingURL=disassembler.js.map