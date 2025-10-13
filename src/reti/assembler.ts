import { ReTIConfig } from "../config";
import * as AsTI from "./ti/assembler_ti";
import * as AsOS from "./os/assembler_os";

export async function assembleFile(code: string[][]): Promise<Array<[number, string]>> {
    if (ReTIConfig.isOS) {
        return AsOS.assembleFile(code);
    }
    else {
        return AsTI.assembleFile(code);
    }
}

export function assembleLine(line: string[]): [number, number, string] {
  if (ReTIConfig.isOS) {
    return AsOS.assembleLine(line);
  }
  return AsTI.assembleLine(line);
}