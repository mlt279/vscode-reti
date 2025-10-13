// OS (Betriebssysteme) assembler wrapper based on Michel Giehl’s compiler

import { ReTIConfig } from "../../config";
import { compile } from "../../third-party-code/reti_compiler"; // adjust path to where you keep his file

/**
 * Assembles a source file for the extended ReTI (OS).
 * Returns same structure as in assembler_ti: Array<[word, message]>.
 */
export async function assembleFile(code: string[][]): Promise<Array<[number, string]>> {
  try {
    const flatCode = code.map(tokens => tokens.join(" ")).join("\n");
    const result = compile(flatCode.split(/\r?\n/));

    const assembled: Array<[number, string]> = [];
    for (let i = 0; i < result.length; i++) {
      assembled.push([result[i], `line ${i}`]);
    }
    return assembled;
  } catch (err: any) {
    return [[0, `OS assembler error: ${err.message ?? err.toString()}`]];
  }
}

export function assembleLine(line: string[]): [number, number, string] {
  const text = line.join(" ");
  try {
    const word = compile([text])[0];    return [0, word, "ok"];
  } catch (err: any) {
    return [-1, 0, `OS assembler error: ${err.message ?? err.toString()}`];
  }
}
