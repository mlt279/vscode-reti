import { computeCode, opType, registerCode } from './retiStructure';
import { generateBitMask } from '../util/retiUtility';
export async function assembleFile(code) {
    let results = [];
    for (let i = 0; i < code.length; i++) {
        let errCode = 0;
        let errMessage = "";
        let line = code[i];
        let instruction = 0;
        [errCode, instruction, errMessage] = assembleLine(line);
        if (errCode !== 0) {
            results.push([instruction, errMessage]);
        }
        else {
            results.push([instruction, line.join(" ")]);
        }
    }
    return results;
}
// Assemble a line of ReTI code. Returns an integer to indicate success, the resulting binInstruction,
// as well as a string containing possible error messages or explanation for assembly.
export function assembleLine(line) {
    let binInstruction = 0;
    const explanationString = "";
    const intValue = 0;
    let register;
    let immediate;
    let destination;
    let instruction;
    // This is needed to ensure correct comparisons later on.
    line = line.map((word) => word.toLowerCase().trim());
    // #region Parse the instruction
    if (line.length === 1) {
        instruction = line[0];
        if (instruction.startsWith('nop')) {
            if (instruction.length === 3) {
                binInstruction = 0b11 << 30;
                return [0, binInstruction, "NOP"];
            }
            else {
                return [-1, binInstruction, `Error: Invalid nop instruction '${instruction}'.`];
            }
        }
        else {
            return [-1, binInstruction, `Error: Invalid instruction '${instruction}'. Expected more than one argument.`];
        }
    }
    else if (line.length === 2) {
        instruction = line[0];
        immediate = line[1];
        // #region Instructions of type 'store'.
        if (instruction.startsWith("store")) {
            binInstruction = opType.STORE << 30;
            switch (instruction.length) {
                case 5:
                    // This means mode is 0b00 so do nothing.
                    break;
                case 8:
                    if (instruction.endsWith('in1')) {
                        binInstruction = binInstruction | registerCode.IN1 << 28;
                        break;
                    }
                    else if (instruction.endsWith('in2')) {
                        binInstruction = binInstruction | registerCode.IN2 << 28;
                        break;
                    }
                    else {
                        return [-1, binInstruction, `Error: Invalid instruction '${instruction}'. Expected valid register ∈ {"IN1", "IN2"} after 'store'.`];
                    }
                default:
                    return [-1, binInstruction, `Error: Invalid store instruction '${instruction}'.`];
            }
        }
        // #endregion
        // #region Instructions of type 'jump'.
        else if (instruction.startsWith('jump')) {
            let condition = 0;
            binInstruction = binInstruction | opType.JUMP << 30;
            if (instruction.length === 4) {
                condition = 0b111;
            }
            else if (instruction.length <= 7) {
                switch (instruction.slice(4)) {
                    case '=':
                    case 'eq':
                        condition = 0b010;
                        break;
                    case '>':
                    case 'gt':
                        condition = 0b001;
                        break;
                    case '<':
                    case 'lt':
                        condition = 0b100;
                        break;
                    case "≥":
                    case ">=":
                    case "geq":
                        condition = 0b011;
                        break;
                    case "≤":
                    case "<=":
                    case "leq":
                        condition = 0b110;
                        break;
                    case "≠":
                    case "!=":
                    case "ieq":
                        condition = 0b101;
                        break;
                    default:
                        return [-1, binInstruction, `Error: Invalid jump instruction '${instruction}'.`];
                }
            }
            else {
                return [-1, binInstruction, `Error: Invalid jump instruction '${instruction}'.`];
            }
            binInstruction = binInstruction | condition << 27;
        }
        // #endregion
    }
    else if (line.length === 3) {
        instruction = line[0];
        register = line[1];
        immediate = line[2];
        // #region Instructions of type 'load'.
        if (instruction.startsWith("load")) {
            binInstruction = opType.LOAD << 30;
            switch (instruction.length) {
                case 4:
                    // Mode would be 0b00 so do nothing.
                    break;
                case 5:
                    if (instruction.endsWith('i')) {
                        binInstruction = binInstruction | 0b11 << 28;
                        break;
                    }
                    else {
                        return [-1, binInstruction, `Error: Invalid instruction '${instruction}'. Expected 'loadi'.`];
                    }
                case 7:
                    if (instruction.endsWith('in1')) {
                        binInstruction = binInstruction | registerCode.IN1 << 28;
                        break;
                    }
                    else if (instruction.endsWith('in2')) {
                        binInstruction = binInstruction | registerCode.IN2 << 28;
                        break;
                    }
                    else {
                        return [-1, binInstruction, `Error: Invalid instruction '${instruction}'. Expected valid register ∈ {"IN1", "IN2"} after 'load'.`];
                    }
                default:
                    return [-1, binInstruction, `Error: Invalid load instruction '${instruction}'.`];
            }
        }
        // #endregion
        // #region Instructions of type 'store'.
        else if (instruction.startsWith("move")) {
            binInstruction = opType.STORE << 30;
            if (instruction.length > 4) {
                return [-1, binInstruction, `Error: Invalid move instruction '${instruction}'.`];
            }
            binInstruction = binInstruction | 0b11 << 28;
            register = line[2];
            let source = line[1];
            switch (source) {
                case 'pc':
                    binInstruction = binInstruction | registerCode.PC << 26;
                    break;
                case 'in1':
                    binInstruction = binInstruction | registerCode.IN1 << 26;
                    break;
                case 'acc':
                    binInstruction = binInstruction | registerCode.ACC << 26;
                    break;
                case 'in2':
                    binInstruction = binInstruction | registerCode.IN2 << 26;
                    break;
                default:
                    return [-1, binInstruction, `Error: Invalid source register '${source}'. Expected ∈ ("PC", "IN1", "IN2", "ACC").`];
            }
        }
        // #endregion
        // #region Instructions of type 'compute'.
        else if (instruction.startsWith('sub')) {
            binInstruction = opType.COMPUTE << 30;
            binInstruction = binInstruction | computeCode.SUB << 26;
            if (instruction.length === 3) {
                binInstruction = binInstruction | 0b1 << 29;
            }
            else if (instruction.endsWith('i') && instruction.length === 4) {
                binInstruction = binInstruction | 0b0 << 29;
            }
            else {
                return [-1, binInstruction, `Error: Invalid sub instruction '${instruction}'.`];
            }
        }
        else if (instruction.startsWith('add')) {
            binInstruction = opType.COMPUTE << 30;
            binInstruction = binInstruction | computeCode.ADD << 26;
            if (instruction.length === 3) {
                binInstruction = binInstruction | 0b1 << 29;
            }
            else if (instruction.endsWith('i') && instruction.length === 4) {
                binInstruction = binInstruction | 0b0 << 29;
            }
            else {
                return [-1, binInstruction, `Error: Invalid add instruction '${instruction}'.`];
            }
        }
        else if (instruction.startsWith('and')) {
            binInstruction = opType.COMPUTE << 30;
            binInstruction = binInstruction | computeCode.AND << 26;
            if (instruction.length === 3) {
                binInstruction = binInstruction | 0b1 << 29;
            }
            else if (instruction.endsWith('i') && instruction.length === 4) {
                binInstruction = binInstruction | 0b0 << 29;
            }
            else {
                return [-1, binInstruction, `Error: Invalid and instruction '${instruction}'.`];
            }
        }
        else if (instruction.startsWith('or')) {
            binInstruction = opType.COMPUTE << 30;
            binInstruction = binInstruction | computeCode.OR << 26;
            if (instruction.length === 2) {
                binInstruction = binInstruction | 0b1 << 29;
            }
            else if (instruction.endsWith('i') && instruction.length === 3) {
                binInstruction = binInstruction | 0b0 << 29;
            }
            else {
                return [-1, binInstruction, `Error: Invalid or instruction '${instruction}'.`];
            }
        }
        else if (instruction.startsWith('oplus')) {
            binInstruction = opType.COMPUTE << 30;
            binInstruction = binInstruction | computeCode.OPLUS << 26;
            if (instruction.length === 5) {
                binInstruction = binInstruction | 0b1 << 29;
            }
            else if (instruction.endsWith('i') && instruction.length === 6) {
                binInstruction = binInstruction | 0b0 << 29;
            }
            else {
                return [-1, binInstruction, `Error: Invalid oplus instruction '${instruction}'.`];
            }
        }
        // #endregion
        let registerType = 0;
        switch (register) {
            case 'pc':
                registerType = registerCode.PC;
                break;
            case 'in1':
                registerType = registerCode.IN1;
                break;
            case 'acc':
                registerType = registerCode.ACC;
                break;
            case 'in2':
                registerType = registerCode.IN2;
                break;
            default:
                return [-1, binInstruction, `Error: Invalid register '${register}'. Expected ∈ ("PC", "IN1", "IN2", "ACC").`];
        }
        binInstruction = binInstruction | registerType << 24;
    }
    else {
        return [-1, binInstruction, `Error: ${line.join(" ")} has too many arguments.`];
    }
    //#endregion parse the instruction
    let immediateValue = 0;
    try {
        immediateValue = parseInt(immediate);
        immediateValue = immediateValue & generateBitMask(24);
    }
    catch (error) {
        return [-1, binInstruction, `Error: '${immediate}' is not a valid value for immediate parameter.`];
    }
    binInstruction = binInstruction | immediateValue;
    return [intValue, binInstruction, explanationString];
}
//# sourceMappingURL=assembler.js.map