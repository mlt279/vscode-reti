import { ReTIConfig } from "../config";
import * as DisTI from "./ti/disassembler_ti";
import * as DisOS from "./os/disassembler_os";
import type { IDisassemblerResult } from "./ReTIInterfaces";

export function disassembleWord(word: number): IDisassemblerResult {
  return ReTIConfig.isOS
    ? DisOS.disassembleWord(word)
    : DisTI.disassembleWord(word);
}
