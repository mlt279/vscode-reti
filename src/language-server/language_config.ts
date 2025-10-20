type OperandType = "register" | "immediate"
type OperandPattern = OperandType[][];

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

const instructionSetTI: Record<string, OperandPattern> = {
    load: [["register", "immediate"]],
    store: [["immediate"]],
    move: [["register", "register"]],
    comp: [["register", "immediate"]],
    jump: [["immediate"]],
    nop: [],
};

const instructionSetOS: Record<string, OperandPattern> = {
    load: [["register", "immediate"]],
    loadin: [["register", "register", "immediate"]],
    store: [["immediate"]],
    storein: [["register", "register", "immediate"]],
    move: [["register", "register"]],
    comp: [["register", "immediate"], ["register", "register"]],
    compi: [["register", "immediate"]],
    jump: [["immediate"]],
    nop: [],
    rti: [],
};

// TODO: Verify patterns are correct.
const instructionPatternsTI: Array<[RegExp, string]> = [
  [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i, "move"],
  [/(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i, "store"],
  [/(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i, "load"],
  [/(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i, "comp"],
  [/(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i, "jump"],
];

// TODO: Create correct patterns.
const instructionPatternsOS: Array<[RegExp, string]> = [
  [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i, "move"],
  [/(?<=(^|\s))STORE?(?!(\w|>|=|≥|<|≠|≤))/i, "store"],
  [/(?<=(^|\s))STOREIN?(?!(\w|>|=|≥|<|≠|≤))/i, "storein"],
  [/(?<=(^|\s))LOAD(I)?(?!(\w|>|=|≥|<|≠|≤))/i, "load"],
  [/(?<=(^|\s))LOADIN?(?!(\w|>|=|≥|<|≠|≤))/i, "loadin"],
  [/(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?!(\w|>|=|≥|<|≠|≤))/i, "comp"],
  [/(?<=(^|\s))(ADDI|SUBI|OPLUSI|ANDI|ORI)(?!(\w|>|=|≥|<|≠|≤))/i, "compi"],
  [/(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i, "jump"],
];


export class LanguageConfig {
    private osMode: boolean = false;

    public setOsMode(osMode: boolean) {this.osMode = osMode;}

    public getValidRegisters():{ [key: string]: string }  {
        if (this.osMode) {return validRegistersOS;}
        else {return validRegistersTI;}
    }

    public getValidRegisterPattern(): RegExp {
        if (this.osMode) {
            return /(?<=(^|\s))(ACC|IN1|IN2|PC)(?!(\w|>|=|≥|<|≠|≤))/i;
        }
        else {
            return /(?<=(^|\s))(ACC|IN1|IN2|PC|SP|BAF|CS|DS)(?!(\w|>|=|≥|<|≠|≤))/i;
        }
    }

    public getValidNumberPattern(): RegExp {
        return /(?<=^|\s)-?\d+(?!(\w|>|=|≥|<|≠|≤))/i;
    }

    public isValidRegister(register: string): boolean {
        return this.getValidRegisterPattern().test(register);
    }

    public isValidOperand(token: string, type: OperandType): boolean {
        if (token === "immediate") {
            return this.getValidNumberPattern().test(token);
        } else {
            return this.getValidRegisterPattern().test(token);
        }
    }

    public getInstructionName(instruction: string): string | null {
    const patterns = this.osMode ? instructionPatternsOS : instructionPatternsTI;
    for (const [pattern, name] of patterns) {
        if (pattern.test(instruction)) {return name;}
    }
    return null;
    }

}

const validInstructionPatterns = [/(?<=(^|\s))MOVE(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))STORE(IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))LOAD(I|IN[12])?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))JUMP(?:!=|<=|>=|>|=|≥|<|≠|≤|lt|eq|leq|gt|geq|neq)?(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))NOP(?!(\w|>|=|≥|<|≠|≤))/i,
    /(?<=(^|\s))(ADD|SUB|OPLUS|AND|OR)(?:I)?(?!(\w|>|=|≥|<|≠|≤))/i
];

const validInstructionsTI: { [key: string]: { documentation: string, usage: string, result: string } } = {
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



// const validTokens = Object.keys(LanguageConfig.getValidRegisters()).concat(Object.keys(validInstructions));

