# reti-tools README

This is the README for your extension "reti-tools". After writing up a brief description, we recommend including the following sections.


## Features

### Emulator

### ReTI-Quiz

### ReTI-Architecture
#### LOAD

**Encoding:**
- `[31, 30] := 0b01`
- `[29, 28] := Mode`
- `[27, 26] := *`
- `[25, 24] := D`
- `[24, ..., 0] := i`

**Mode:**
- `Mode = 0b00: LOAD D i`  
  `Effect: D := M<i>`
- `Mode = 0b01: LOADIN1 D i`  
  `Effect: D := M<i + <IN1>>`
- `Mode = 0b10: LOADIN2 D i`  
  `Effect: D := M<i + <IN2>>`
- `Mode = 0b11: LOADI D i`  
  `Effect: D := i`

---

#### STORE

**Encoding:**
- `[31, 30] := 0b10`
- `[29, 28] := Mode`
- `[27, 26] := S`
- `[25, 24] := D`
- `[24, ..., 0] := i`

**Mode:**
- `Mode = 0b00: STORE i`  
  `Effect: M<i> := ACC`
- `Mode = 0b01: STOREIN1 i`  
  `Effect: M<<IN1>+i> := ACC`
- `Mode = 0b10: STOREIN2 i`  
  `Effect: M<<IN2>+i> := ACC`
- `Mode = 0b11: MOVE S D`  
  `Effect: D := S`

---

#### COMPUTE

**Encoding:**
- `[31, 30] := 0b00`
- `[29] := MI`
- `[28, 27, 26] := F`
- `[25, 24] := D`
- `[24, ..., 0] := i`

**MI = 0:**
- `F = 0b010: SUBI D i`  
  `Effect: D := D - i`
- `F = 0b011: ADDI D i`  
  `Effect: D := D + i`
- `F = 0b100: OPLUS D i`  
  `Effect: D := D ⊕ i`
- `F = 0b101: ORI D i`  
  `Effect: D := D ∨ i`
- `F = 0b110: ANDI D i`  
  `Effect: D := D ∧ i`

**MI = 1:**
- `F = 0b010: SUB D i`  
  `Effect: D := D - M<i>`
- `F = 0b011: ADD D i`  
  `Effect: D := D + M<i>`
- `F = 0b100: OPLUS D i`  
  `Effect: D := D ⊕ M<i>`
- `F = 0b101: OR D i`  
  `Effect: D := D ∨ M<i>`
- `F = 0b110: AND D i`  
  `Effect: D := D ∧ M<i>`

---
#### JUMP

**Encoding:**
- `[31, 30] := 0b11`
- `[29, 28, 27] := C`
- `[26, 25, 24] := *`
- `[24, ..., 0] := i`

**C (Condition):**
- `C = 0b000: NOP`  
  `Effect: PC := PC + 1`

- `C = 0b001: JUMP> i`  
  `Effect: PC := (ACC > 0) ? PC + i : PC + 1`

- `C = 0b010: JUMP= i`  
  `Effect: PC := (ACC = 0) ? PC + i : PC + 1`

- `C = 0b011: JUMP≥ i`  
  `Effect: PC := (ACC ≥ 0) ? PC + i : PC + 1`

- `C = 0b100: JUMP< i`  
  `Effect: PC := (ACC < 0) ? PC + i : PC + 1`

- `C = 0b101: JUMP≠ i`  
  `Effect: PC := (ACC ≠ 0) ? PC + i : PC + 1`

- `C = 0b110: JUMP≤ i`  
  `Effect: PC := (ACC ≤ 0) ? PC + i : PC + 1`

- `C = 0b111: JUMP i`  
  `Effect: PC := PC + i`


## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0