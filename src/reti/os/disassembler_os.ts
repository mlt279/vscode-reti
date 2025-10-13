import { error } from "console";
import { decompile } from "../../third-party-code/reti_decompiler";
import type { IDisassemblerResult } from "../ReTIInterfaces";

export function disassembleWord(word: number): IDisassemblerResult {
  try {
    const result = decompile(word);
    if (result === undefined) {
        throw error("Invalid instruction.");
    }
    return { instruction: result ?? "???", explanation: [] };
  } catch (err: any) {
    return { instruction: "???", explanation: [["Error", 0, err.message ?? err.toString()]] };
  }
}