export interface IReTIPort {
    getRegister(index: number): number;
    setRegister(index: number, value: number): void;

    getMem(addr: number): number;
    setMem(addr: number, value: number): void;

    getCode(addr: number): number;
    codeSize(): number;

    getPC(): number;
    setPC(v: number): void;
}

export interface IReTIArchitecture {
    readonly register_names: string[];

    step(_cpu: IReTIPort, _instruction: number): number;

    assemble?(tokens: string[]): [err: number, word: number, msg: string];
    disassemble?(word: number): string;
}

export interface IDisassemblerResult {
  instruction: string;
  explanation: [string, number, string][];
}

export interface ReTIState {


    registers: number[];


    data: Map<number, number>;


    endCondition: string;


}