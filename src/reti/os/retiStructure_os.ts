export enum osRegisterCode {
  PC = 0, IN1, IN2, ACC, SP, BAF, CS, DS,
}

// src/reti/os/retiStructure_os.ts
export enum osRegisterCode {
  PC = 0, IN1, IN2, ACC, SP, BAF, CS, DS,
}

export class ReTI_OS_State {
  code: Uint32Array;
  sram: Uint32Array;
  eprom: Uint32Array;
  regs: Uint32Array;
  uart: { rx: number[]; tx: number[]; status: number };

  constructor(code: number[], data: number[]) {
    this.code = new Uint32Array(code);
    this.sram = new Uint32Array(Math.max(1 << 16, data.length));
    for (let i = 0; i < data.length; i++) this.sram[i] = data[i] >>> 0;
    this.eprom = new Uint32Array(this.code.length);
    this.eprom.set(this.code);
    this.regs = new Uint32Array(8);
    this.uart = { rx: [], tx: [], status: 0b11 };
    this.regs[osRegisterCode.SP] = 0x8000;
  }

  get pc() { return this.regs[osRegisterCode.PC] >>> 0; }
  set pc(v: number) { this.regs[osRegisterCode.PC] = v >>> 0; }

  private dsFill(addr: number): number {
    const DS = this.regs[osRegisterCode.DS] >>> 0;
    return (addr | (DS & 0xFFC00000)) >>> 0;
  }

  read(addr: number): number {
    addr >>>= 0;
    const dev = addr >>> 30;
    if (dev === 0b00) return this.eprom[addr & 0x3FFFFFFF] >>> 0;
    if (dev === 0b01) return this.readUART(addr & 0x3FFFFFFF) >>> 0;
    return this.sram[addr & 0x7FFFFFFF] >>> 0;
  }
  write(addr: number, val: number) {
    addr >>>= 0; val >>>= 0;
    const dev = addr >>> 30;
    if (dev === 0b01) { this.writeUART(addr & 0x3FFFFFFF, val); return; }
    this.sram[addr & 0x7FFFFFFF] = val >>> 0;
  }
  readDS(addr: number) { return this.read(this.dsFill(addr)); }
  writeDS(addr: number, val: number) { this.write(this.dsFill(addr), val); }

  private readUART(off: number): number {
    if (off === 2) return this.uart.status;
    if (off === 1) return this.uart.rx.shift() ?? 0;
    return 0;
  }
  private writeUART(off: number, val: number) {
    if (off === 0) this.uart.tx.push(val >>> 0);
    if (off === 2) this.uart.status = val & 0x3;
  }

  push(val: number) {
    const sp = (--this.regs[osRegisterCode.SP]) >>> 0;
    this.sram[sp & 0x7FFFFFFF] = val >>> 0;
  }
  pop(): number {
    const sp = this.regs[osRegisterCode.SP] >>> 0;
    const v = this.sram[sp & 0x7FFFFFFF] >>> 0;
    this.regs[osRegisterCode.SP] = (sp + 1) >>> 0;
    return v;
  }
}
