type OperandType = "register" | "unsigned" | "signed"
type OperandPattern = OperandType[];
type OperandPatternList = OperandPattern[];

const operatorAliases: {[key: string] : string} = {
    "lt": "<",
    "eq": "=",
    "gt": ">",
    "leq": "≤",
    "geq": "≥",
    "neq": "≠",
    "<=": "≤",
    ">=": "≥",
    "!=": "≠"
};

const validRegistersTI: { [key: string]: string } = {
    "ACC": "Accumulator",
    "PC": "Program Counter",
    "IN1": "Indexregister 1",
    "IN2": "Indexregister 2"
};

const validRegistersOS: { [key: string]: string } = {
    ...validRegistersTI,
    "SP": "Stack Pointer",
    "BAF": "Begin Active Frame",
    "CS": "Begin of Code Segment",
    "DS": "Begin of Data Segment"
};

const documentationTI: { [key: string]: { documentation: string, usage: string, result: string } } = {
    "MOVE": { documentation: "Moves content of the first register to the second register.", usage: "MOVE S D", result: "D := S" },
    "STORE": { documentation: "Stores the value of ACC register into the i-th memory cell.", usage: "STORE i", result: "M(i) := ACC" }, 
    "STOREIN1": { documentation: "Stores the value of ACC register into the (i+IN1)-th memory cell.", usage: "STOREIN1 i", result: "M(i+IN1) := ACC" }, 
    "STOREIN2": { documentation: "Stores the value of ACC register into the (i+IN2)-th memory cell.", usage: "STOREIN2 i", result: "M(i+IN2) := ACC" },
    "LOAD": { documentation: "Loads the value of the i-th memory cell into the destination register.", usage: "LOAD D i", result: "D := M(i)" }, 
    "LOADI": { documentation: "Loads the value of i into the destination register.", usage: "LOADI D i", result: "D := i" }, 
    "LOADIN1": { documentation: "Loads the value of the (i+IN1)-th memory cell into the destination register.", usage: "LOADIN1 D i", result: "D := M(IN1+i)" }, 
    "LOADIN2": { documentation: "Loads the value of the (i+IN2)-th memory cell into the destination register.", usage: "LOADIN2 D i", result: "D := M(IN1+i)" },
    "JUMP": { documentation: "Increases the program counter by i.", usage: "JUMP i", result: "PC := PC + i" }, 
    "JUMP>": { documentation: "Increases the program counter by i if ACC > 0.", usage: "JUMP> i", result: "if ACC > 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP=": { documentation: "Increases the program counter by i if ACC = 0.", usage: "JUMP= i", result: "if ACC = 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≥": { documentation: "Increases the program counter by i if ACC ≥ 0.", usage: "JUMP≥ i", result: "if ACC ≥ 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP<": { documentation: "Increases the program counter by i if ACC < 0.", usage: "JUMP< i", result: "if ACC < 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≠": { documentation: "Increases the program counter by i if ACC ≠ 0.", usage: "JUMP≠ i", result: "if ACC ≠ 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≤": { documentation: "Increases the program counter by i if ACC ≤ 0.", usage: "JUMP≤ i", result: "if ACC ≤ 0 then PC := PC + i else PC := PC + 1" }, 
    "NOP": { documentation: "Increase the program counter by 1 (does nothing).", usage: "NOP", result: "PC := PC + 1" },
    "ADD": { documentation: "Adds the value of the i-th memory cell to the value of the destination register.", usage: "ADD D i", result: "D := D + M(i)" }, 
    "ADDI": { documentation: "Adds the value of i to the value of the destination register.", usage: "ADDI D i", result: "D := D + i" }, 
    "SUB": { documentation: "Subtracts the value of the i-th memory cell from the value of the destination register.", usage: "SUB D i", result: "D := D - M(i)" }, 
    "SUBI": { documentation: "Subtracts the value of i from the value of the destination register.", usage: "SUBI D i", result: "D := D - i" }, 
    "OPLUS": { documentation: "Bitwise XNOR of the value of the i-th memory cell and the value of the destination register.", usage: "OPLUS D i", result: "D := D ⊕ M(i)" }, 
    "OPLUSI": { documentation: "Bitwise XNOR of the value of i and the value of the destination register.", usage: "OPLUSI D i", result: "D := D ⊕ i" }, 
    "AND": { documentation: "Bitwise AND of the value of the i-th memory cell and the value of the destination register.", usage: "AND D i", result: "D := D ∧ M(i)" }, 
    "ANDI": { documentation: "Bitwise AND of the value of i and the value of the destination register.", usage: "ANDI D i", result: "D := D ∧ i" }, 
    "OR": { documentation: "Bitwise OR of the value of the i-th memory cell and the value of the destination register.", usage: "OR D i", result: "D := D ∨ M(i)" }, 
    "ORI": { documentation: "Bitwise OR of the value of i and the value of the destination register.", usage: "ORI D i", result: "D := D ∨ i" }
};

const documentationOS: { [key: string]: { documentation: string, usage: string, result: string } } = {
    "MOVE": { documentation: "Moves content of the first register to the second register.", usage: "MOVE S D", result: "D := S" },
    "STORE": { documentation: "Stores the value of the specified register into the i-th memory cell.", usage: "STORE S i", result: "M(i) := S" }, 
    "STOREIN": { documentation: "Stores the value of specified register S into the (i + D)-th memory cell.", usage: "STOREIN D S i", result: "M(D+i) := S" }, 
    "LOAD": { documentation: "Loads the value of the i-th memory cell into the destination register.", usage: "LOAD D i", result: "D := M(i)" }, 
    "LOADI": { documentation: "Loads the value of i into the destination register.", usage: "LOADI D i", result: "D := i" }, 
    "LOADIN": { documentation: "Loads the value of the (i+S)-th memory cell into the specified destination register.", usage: "LOADIN S D i", result: "D := M(S+i)" }, 
    "JUMP": { documentation: "Increases the program counter by i.", usage: "JUMP i", result: "PC := PC + i" }, 
    "JUMP>": { documentation: "Increases the program counter by i if ACC > 0.", usage: "JUMP> i", result: "if ACC > 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP=": { documentation: "Increases the program counter by i if ACC = 0.", usage: "JUMP= i", result: "if ACC = 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≥": { documentation: "Increases the program counter by i if ACC ≥ 0.", usage: "JUMP≥ i", result: "if ACC ≥ 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP<": { documentation: "Increases the program counter by i if ACC < 0.", usage: "JUMP< i", result: "if ACC < 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≠": { documentation: "Increases the program counter by i if ACC ≠ 0.", usage: "JUMP≠ i", result: "if ACC ≠ 0 then PC := PC + i else PC := PC + 1" }, 
    "JUMP≤": { documentation: "Increases the program counter by i if ACC ≤ 0.", usage: "JUMP≤ i", result: "if ACC ≤ 0 then PC := PC + i else PC := PC + 1" }, 
    "NOP": { documentation: "Increase the program counter by 1 (does nothing).", usage: "NOP", result: "PC := PC + 1" },
    "INT": { documentation: "", usage: "INT i", result: "PC := IVT[i]" },
    "RTI": { documentation: "", usage: "RTI", result: "Return address removed from the stack, loaded into the PC, switch to user mode." },
    "ADD": { documentation: "Adds the value of the i-th memory cell to the value of the destination register or if two registers given adds both register values together.", 
        usage: "ADD D i || ADD D S", result: "D := D + M(i) || D := D + S" }, 
    "ADDI": { documentation: "Adds the value of i to the value of the destination register.", 
        usage: "ADDI D i", result: "D := D + i" }, 
    "SUB": { documentation: "Subtracts the value of the i-th memory cell from the value of the destination register or if two registers given subtracts the value of S from D.", 
        usage: "SUB D i || SUB D S", result: "D := D + M(i) || D := D - S" }, 
    "SUBI": { documentation: "Subtracts the value of i from the value of the destination register.", 
        usage: "SUBI D i", result: "D := D - i" }, 
    "OPLUS": { documentation: "Bitwise XNOR of the value of the i-th memory cell or the value of the source register and the value of the destination register.", 
        usage: "OPLUS D i || OPLUS D S", result: "D := D ⊕ M(i) || D := D ⊕ S" }, 
    "OPLUSI": { documentation: "Bitwise XNOR of the value of i and the value of the destination register.", 
        usage: "OPLUSI D i", result: "D := D ⊕ i" }, 
    "AND": { documentation: "Bitwise AND of the value of i or the value of the source register and the value of the destination register.", 
        usage: "AND D i || AND D S", result: "D := D ∧ M(i) || D := D ∧ S" }, 
    "ANDI": { documentation: "Bitwise AND of the value of i and the value of the destination register.", 
        usage: "ANDI D i", result: "D := D ∧ i" }, 
    "OR": { documentation: "Bitwise OR of the value of i and the value of the destination register.", 
        usage: "OR D i || OR D S", result: "D := D ∨ M(i) || D := D ∨ S" }, 
    "ORI": { documentation: "Bitwise OR of the value of i and the value of the destination register.", 
        usage: "ORI D i", result: "D := D ∨ i" },
    "MOD": { documentation: "Modulo operation of the value of the i-th memory cell and the destination register or of the value in S with the value in D.",
    usage: "MOD D i || MOD D S", result: "D:= D % M(i) ||D := D % S" },
    "MODI": { documentation: "Modulo operation of the value of and the destination register.",
    usage: "MODI D i", result: "D:= D % i" },
    "MULT": { documentation:  "Multiplies the value of the i-th memory cell with the value of the destination register or if two registers given multiplies the value of S with D.",
    usage: "MODI D i", result: "D:= D % i" },
    "MULTI": { documentation: "Multiplication of the value of i and the destination register.",
    usage: "MODI D i", result: "D:= D % i" },
    "DIV": { documentation:  "Divides the value of the i-th memory cell with the value of the destination register or if two registers given divides the value of S with D.",
    usage: "MODI D i", result: "D:= D % i" },
    "DIVI": { documentation: "Division of the value of i and the destination register.",
    usage: "MODI D i", result: "D:= D % i" },
    
};

const instructionSetTI: Record<string, OperandPatternList> = {
    "load": [["register", "unsigned"]],
    "loadi": [["register", "signed"]],
    "store": [["unsigned"]],
    "storei": [["signed"]],
    "move": [["register", "register"]],
    "compute": [["register", "unsigned"]],
    "compute immediate": [["register", "signed"]],
    "jump": [["signed"]],
    "nop": [],
};

// TODO: Look up in powerpoint and recordings wether the cheatsheet regarding signed and unsigned usage is correct.
const instructionSetOS: Record<string, OperandPatternList> = {
    "load": [["register", "unsigned"]],
    "loadi": [["register", "signed"]],
    "loadin": [["register", "register", "unsigned"]],
    "store": [["register", "unsigned"]],
    "storein": [["register", "register", "unsigned"]],
    "move": [["register", "register"]],
    "compute": [["register", "unsigned"], ["register", "register"]],
    "compute immediate": [["register", "signed"]],
    "jump": [["signed"]],
    "int": [["signed"]],
    "nop": [],
    "rti": [],
};

const instructionPatternsTI: Array<[RegExp, string]> = [
  [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i, "move"],
  [/(?<=(^|\s))STORE(?!(\w|>|=|≥|<|≠|≤))/i, "store"],
  [/(?<=(^|\s))STORE(IN[12])(?!(\w|>|=|≥|<|≠|≤))/i, "storei"],
  [/(?<=(^|\s))LOAD?(?!(\w|>|=|≥|<|≠|≤))/i, "load"],
  [/(?<=(^|\s))LOAD(I|IN[12])(?!(\w|>|=|≥|<|≠|≤))/i, "loadi"],
  [/(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)?(?!(\w|>|=|≥|<|≠|≤))/i, "compute"],
  [/(?<=(^|\s))(ADDI|SUBI|OPLUSI|ANDI|ORI)?(?!(\w|>|=|≥|<|≠|≤))/i, "compute immediate"],
  [/(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i, "jump"],
  [/(?<=(^|\s))nop(?!(\w|>|=|≥|<|≠|≤))/i,"nop"],
];

const instructionPatternsOS: Array<[RegExp, string]> = [
  [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i, "move"],
  [/(?<=(^|\s))STORE?(?!(\w|>|=|≥|<|≠|≤))/i, "store"],
  [/(?<=(^|\s))STOREIN?(?!(\w|>|=|≥|<|≠|≤))/i, "storein"],
  [/(?<=(^|\s))LOAD(?!(\w|>|=|≥|<|≠|≤))/i, "load"],
  [/(?<=(^|\s))LOADI(?!(\w|>|=|≥|<|≠|≤))/i, "loadi"],
  [/(?<=(^|\s))LOADIN?(?!(\w|>|=|≥|<|≠|≤))/i, "loadin"],
  [/(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR|MULT|DIV|MOD)(?!(\w|>|=|≥|<|≠|≤))/i, "compute"],
  [/(?<=(^|\s))(ADDI|SUBI|OPLUSI|ANDI|ORI|MULTI|DIVI|MODI)(?!(\w|>|=|≥|<|≠|≤))/i, "compute immediate"],
  [/(?<=(^|\s))(JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?)(?!(\w|>|=|≥|<|≠|≤))/i, "jump"],
  [/(?<=(^|\s))INT(?!(\w|>|=|≥|<|≠|≤))/i,"int"],
  [/(?<=(^|\s))nop(?!(\w|>|=|≥|<|≠|≤))/i,"nop"],
  [/(?<=(^|\s))rti(?!(\w|>|=|≥|<|≠|≤))/i,"rti"]
];

export class LanguageConfig {
    private osMode: boolean = false;

    public setOsMode(osMode: boolean) {this.osMode = osMode;}

    public getDocumentation() {
        if (this.osMode) {
            return documentationOS;
        } else {
            return documentationTI;
        }
    }

    public getValidRegisters():{ [key: string]: string }  {
        if (this.osMode) {
            return validRegistersOS;
        }
        else {
            return validRegistersTI;
        }
    }

    public getValidTokens(){
        return Object.keys(this.getValidRegisters()).concat(Object.keys(this.getDocumentation()));
    }

    public getInstructionPatterns(): Array<[RegExp, string]>{
        if (this.osMode){
            return instructionPatternsOS;
        }
        else {
            return instructionPatternsTI;
        }
    }

    public getInstructionSet(): Record<string, OperandPatternList>{
        if (this.osMode){
            return instructionSetOS;
        }
        else {
            return instructionSetTI;
        }
    }

    public getValidRegisterPattern(): RegExp {
        if (this.osMode) {
            return /(?<=(^|\s))(ACC|IN1|IN2|PC|SP|BAF|CS|DS)(?!(\w|>|=|≥|<|≠|≤))/i;
        }
        else {
            return /(?<=(^|\s))(ACC|IN1|IN2|PC)(?!(\w|>|=|≥|<|≠|≤))/i;
        }
    }

    public getValidNumberPattern(): RegExp {
        return  /(?<=(^|\s))((0b(0|1)+)|(0x[A-Fa-f0-9]+)|(-?\d+))(?!(\w|>|=|≥|<|≠|≤))/i;
    }

    // Returns -1 if the instruction has not been found.
    public getNumOperands(instruction: string): number {
        let name = this.getInstructionName(instruction)

        if (!name) {return -1};

        let list = this.getInstructionSet()[name];

        if (!list) return -1;

        if (list.length === 0) return 0;

        return list[0].length;

    }

    public isValidRegister(register: string): boolean {
        return this.getValidRegisterPattern().test(register);
    }

    public isValidOperand(token: string, type: OperandType): boolean {
        if (type === "unsigned" || type === "signed") {
            return this.getValidNumberPattern().test(token);
        } else {
            return this.getValidRegisterPattern().test(token);
        }
    }

    public getInstructionName(instruction: string): string | null {
    // If this is the case, the instruction is already formatted.
    if (instruction in this.getInstructionSet()) {
        return instruction;
    }

    for (const [pattern, name] of this.getInstructionPatterns()) {
        if (pattern.test(instruction)) {
            return name;
        }
    }
    return null;
    }

}
