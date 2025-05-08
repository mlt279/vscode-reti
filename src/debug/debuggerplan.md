ReTIDebugger {
    1. constructor
    2. loadSource
    -> initializeContents -> Assemble if text, parse comment lines, read data file possibly

    3. run() aber erst nur über step funktion (always stopping on entry)
    -> step()
    4. setBreakPoints()
    -> verifyBreakPoints
    -- setInstructionBreakpoint()?
    5. run() vervollständigen + continue()
    6. getRegisters()
    7. setRegisters()?
    8. getMemory(address: number)
    9. setMemory(address: number)?
    10. modifyInstruction(address: number)?
}

































extension <-> activateReTIDebug <-> retiDebugSession <-> retiDebugger (runtime)

TODO:
retiDebugger:
- create class and needed interfaces in file
- start()
- continue()
- step()
- getBreakpoints()
- clearBreakPoint()
- setBreakPoint()
- setInstructionBreakpoint()
- clearInstructionBreakpoint()
- getLocalVariables() -> getRegisters
- getGlobalVariables() -> getMemory()

- loadSource()
- updateCurrentLine()

- disassemble()
- getLine()?
- getWord()?
- initializeContents()
- findNextStatement()
- executeLine()
- verifyBreakpoints()

- sendEvent()
- normalizePathAndCastin()