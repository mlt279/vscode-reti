import { IReTIArchitecture, IReTIPort } from "../ReTIInterfaces"; // use your shared interfaces
import { osRegisterCode, ReTI_OS_State } from "./retiStructure_os";

const U22 = (x: number) => x & ((1 << 22) - 1);
const S22 = (x: number) => ((x & (1 << 21)) ? (x | ~((1 << 22) - 1)) : (x & ((1 << 22) - 1))) >>> 0;

export class ReTIOS implements IReTIArchitecture {
  readonly register_names = ["PC","IN1","IN2","ACC","SP","BAF","CS","DS"];

  step(_cpu: IReTIPort, _instruction: number): number {
    const group = _instruction >>> 30;

    switch (group) {
      case 0b00: return this.executeCompute(_cpu, _instruction);
      case 0b01: return this.executeLoad(_cpu, _instruction);
      case 0b10: return this.executeStore(_cpu, _instruction);
      case 0b11: return this.executeJump(_cpu, _instruction);
      default: return 1;
    }
  }

  private executeCompute(cpu: IReTIPort, instruction: number): number {
    return 0;
  }

    private executeLoad(cpu: IReTIPort, instruction: number): number {
    return 0;
  }

    private executeStore(cpu: IReTIPort, instruction: number): number {
    return 0;
  }

    private executeJump(cpu: IReTIPort, instruction: number): number {
    return 0;
  }


}
