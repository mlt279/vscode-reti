import { Logger, logger, LoggingDebugSession, InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, InvalidatedEvent, Thread, StackFrame, Scope, Source, Handles, Breakpoint } from '@vscode/debugadapter'; // MemoryEvent (setVariableRequest) ProgressStartEvent, ProgressUpdateEvent, ProgressEndEvent, 
import { basename } from 'path-browserify';
import { ReTIRuntime, RuntimeVariable } from './retiRuntime'; // timeout, IRuntimeVariableType
const { Subject } = require('await-notify');
export class ReTIDebugSession extends LoggingDebugSession {
    // we don't support multiple threads, so we can use a hardcoded ID for the default thread
    static threadID = 1;
    _runtime;
    _variableHandles = new Handles();
    _configurationDone = new Subject();
    _cancellationTokens = new Map();
    // private _reportProgress = false;
    // private _progressId = 10000;
    // private _cancelledProgressId: string | undefined = undefined;
    // private _isProgressCancellable = true;
    _valuesInHex = false;
    _useInvalidatedEvent = false;
    _addressesInHex = true;
    /**
     * Creates a new debug adapter that is used for one debug session.
     * We configure the default implementation of a debug adapter here.
     */
    constructor(fileAccessor) {
        super("reti-debug.txt");
        // this debugger uses zero-based lines and columns
        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);
        this._runtime = new ReTIRuntime(fileAccessor);
        // setup event handlers
        this._runtime.on('stopOnEntry', () => {
            this.sendEvent(new StoppedEvent('entry', ReTIDebugSession.threadID));
        });
        this._runtime.on('stopOnStepIn', () => {
            this.sendEvent(new StoppedEvent('stepIn', ReTIDebugSession.threadID));
        });
        this._runtime.on('stopOnStepOver', () => {
            this.sendEvent(new StoppedEvent('stepOver', ReTIDebugSession.threadID));
        });
        this._runtime.on('stopOnStepOut', () => {
            this.sendEvent(new StoppedEvent('stepOut', ReTIDebugSession.threadID));
        });
        this._runtime.on('stopOnBreakpoint', () => {
            this.sendEvent(new StoppedEvent('breakpoint', ReTIDebugSession.threadID));
        });
        this._runtime.on('stopOnDataBreakpoint', () => {
            this.sendEvent(new StoppedEvent('data breakpoint', ReTIDebugSession.threadID));
        });
        this._runtime.on('stopOnInstructionBreakpoint', () => {
            this.sendEvent(new StoppedEvent('instruction breakpoint', ReTIDebugSession.threadID));
        });
        this._runtime.on('breakpointValidated', (bp) => {
            this.sendEvent(new BreakpointEvent('changed', { verified: bp.verified, id: bp.id }));
        });
        this._runtime.on('end', () => {
            this.sendEvent(new TerminatedEvent());
        });
    }
    /**
     * The 'initialize' request is the first request called by the frontend
     * to interrogate the features the debug adapter provides.
     */
    initializeRequest(response, args) {
        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};
        // the adapter implements the configurationDone request.
        response.body.supportsConfigurationDoneRequest = true;
        // Deactivated for now, would be interesting for registers.
        // // make VS Code use 'evaluate' when hovering over source
        // response.body.supportsEvaluateForHovers = true;
        // make VS Code support data breakpoints
        response.body.supportsDataBreakpoints = true;
        // // make VS Code support completion in REPL
        // response.body.supportsCompletionsRequest = true;
        // response.body.completionTriggerCharacters = [ ".", "[" ];
        // make VS Code send cancel request
        response.body.supportsCancelRequest = true;
        // make VS Code send the breakpointLocations request
        response.body.supportsBreakpointLocationsRequest = true;
        // // the adapter defines two exceptions filters, one with support for conditions.
        // response.body.supportsExceptionFilterOptions = true;
        // response.body.exceptionBreakpointFilters = [
        // 	{
        // 		filter: 'namedException',
        // 		label: "Named Exception",
        // 		description: `Break on named exceptions. Enter the exception's name as the Condition.`,
        // 		default: false,
        // 		supportsCondition: true,
        // 		conditionDescription: `Enter the exception's name`
        // 	},
        // 	{
        // 		filter: 'otherExceptions',
        // 		label: "Other Exceptions",
        // 		description: 'This is a other exception',
        // 		default: true,
        // 		supportsCondition: false
        // 	}
        // ];
        // make VS Code send exceptionInfo request
        response.body.supportsExceptionInfoRequest = true;
        // // make VS Code send setVariable request
        response.body.supportsSetVariable = true;
        // Implement if time
        // // make VS Code send setExpression request
        // response.body.supportsSetExpression = true;
        // make VS Code send disassemble request
        // TODO: Implement if time
        // response.body.supportsDisassembleRequest = true;
        response.body.supportsSteppingGranularity = true;
        response.body.supportsInstructionBreakpoints = true;
        // Implement if time
        // // make VS Code able to read and write variable memory
        response.body.supportsReadMemoryRequest = true;
        // response.body.supportsWriteMemoryRequest = true;
        response.body.supportSuspendDebuggee = true;
        response.body.supportTerminateDebuggee = true;
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }
    /**
     * Called at the end of the configuration sequence.
     * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
     */
    configurationDoneRequest(response, args) {
        super.configurationDoneRequest(response, args);
        // notify the launchRequest that configuration has finished
        this._configurationDone.notify();
    }
    disconnectRequest(response, args, request) {
        console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
    }
    async attachRequest(response, args) {
        return this.launchRequest(response, args);
    }
    async launchRequest(response, args) {
        // make sure to 'Stop' the buffered logging if 'trace' is not set
        logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);
        // wait 1 second until configuration has finished (and configurationDoneRequest has been called)
        await this._configurationDone.wait(1000);
        // start the program in the runtime
        if (!await this._runtime.start(args.program, !!args.stopOnEntry, !args.noDebug)) {
            this.sendErrorResponse(response, {
                id: 1001,
                format: `assemble error`,
                showUser: args.compileError === 'show' ? true : (args.compileError === 'hide' ? false : undefined)
            });
        }
        else {
            this.sendResponse(response);
        }
    }
    async setBreakPointsRequest(response, args) {
        const path = args.source.path;
        const clientLines = args.lines || [];
        // clear all breakpoints for this file
        this._runtime.clearBreakpoints(path);
        // set and verify breakpoint locations
        const actualBreakpoints0 = clientLines.map(async (l) => {
            const { verified, line, id } = await this._runtime.setBreakPoint(path, this.convertClientLineToDebugger(l));
            const bp = new Breakpoint(verified, this.convertDebuggerLineToClient(line));
            bp.id = id;
            return bp;
        });
        const actualBreakpoints = await Promise.all(actualBreakpoints0);
        // send back the actual breakpoint positions
        response.body = {
            breakpoints: actualBreakpoints
        };
        this.sendResponse(response);
    }
    breakpointLocationsRequest(response, args, request) {
        if (args.source.path) {
            const bps = this._runtime.getBreakpoints(args.source.path, this.convertClientLineToDebugger(args.line));
            response.body = {
                breakpoints: bps.map(col => {
                    return {
                        line: args.line,
                        column: this.convertDebuggerColumnToClient(col)
                    };
                })
            };
        }
        else {
            response.body = {
                breakpoints: []
            };
        }
        this.sendResponse(response);
    }
    exceptionInfoRequest(response, args) {
        response.body = {
            exceptionId: 'Exception ID',
            description: 'This is a descriptive description of the exception.',
            breakMode: 'always',
            details: {
                message: 'Message contained in the exception.',
                typeName: 'Short type name of the exception object',
                stackTrace: 'stack frame 1\nstack frame 2',
            }
        };
        this.sendResponse(response);
    }
    // Likely can't be deactivated.
    threadsRequest(response) {
        // runtime supports no threads so just return a default thread.
        response.body = {
            threads: [
                new Thread(ReTIDebugSession.threadID, "thread 1"),
                new Thread(ReTIDebugSession.threadID + 1, "thread 2"),
            ]
        };
        this.sendResponse(response);
    }
    // Likely can't be deactivated
    stackTraceRequest(response, args) {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
        const endFrame = startFrame + maxLevels;
        const stk = this._runtime.stack(startFrame, endFrame);
        response.body = {
            stackFrames: stk.frames.map((f, ix) => {
                const sf = new StackFrame(f.index, f.name, this.createSource(f.file), this.convertDebuggerLineToClient(f.line));
                if (typeof f.column === 'number') {
                    sf.column = this.convertDebuggerColumnToClient(f.column);
                }
                if (typeof f.instruction === 'number') {
                    const address = this.formatAddress(f.instruction);
                    sf.name = `${f.name} ${address}`;
                    sf.instructionPointerReference = address;
                }
                return sf;
            }),
            // 4 options for 'totalFrames':
            //omit totalFrames property: 	// VS Code has to probe/guess. Should result in a max. of two requests
            totalFrames: stk.count // stk.count is the correct size, should result in a max. of two requests
            //totalFrames: 1000000 			// not the correct size, should result in a max. of two requests
            //totalFrames: endFrame + 20 	// dynamically increases the size with every requested chunk, results in paging
        };
        this.sendResponse(response);
    }
    // Likely can't be deactivated. Return "locals" ~ "registers"
    scopesRequest(response, args) {
        response.body = {
            scopes: [
                new Scope("Registers", this._variableHandles.create('locals'), false)
            ]
        };
        this.sendResponse(response);
    }
    // TODO: Implement if time
    // protected async writeMemoryRequest(response: DebugProtocol.WriteMemoryResponse, { data, memoryReference, offset = 0 }: DebugProtocol.WriteMemoryArguments) {
    // 	const variable = this._variableHandles.get(Number(memoryReference));
    // 	if (typeof variable === 'object') {
    // 		const decoded = base64.toByteArray(data);
    // 		variable.setMemory(decoded, offset);
    // 		response.body = { bytesWritten: decoded.length };
    // 	} else {
    // 		response.body = { bytesWritten: 0 };
    // 	}
    // 	this.sendResponse(response);
    // 	this.sendEvent(new InvalidatedEvent(['variables']));
    // }
    async readMemoryRequest(response, { offset = 0, count, memoryReference }) {
        // const variable = this._variableHandles.get(Number(memoryReference));
        // if (typeof variable === 'object' && variable.memory) {
        // 	const memory = variable.memory.subarray(
        // 		Math.min(offset, variable.memory.length),
        // 		Math.min(offset + count, variable.memory.length),
        // 	);
        // 	response.body = {
        // 		address: offset.toString(),
        // 		data: base64.fromByteArray(memory),
        // 		unreadableBytes: count - memory.length
        // 	};
        // } else {
        // 	response.body = {
        // 		address: offset.toString(),
        // 		data: '',
        // 		unreadableBytes: count
        // 	};
        // }
        response.body = {
            address: memoryReference,
            data: memoryReference,
            unreadableBytes: count + offset
        };
        this.sendResponse(response);
    }
    async variablesRequest(response, args, request) {
        let vs = [];
        const v = this._variableHandles.get(args.variablesReference);
        if (v === 'locals') {
            vs = this._runtime.getLocalVariables();
        }
        else if (v === 'globals') {
            if (request) {
                this._cancellationTokens.set(request.seq, false);
                vs = await this._runtime.getGlobalVariables(() => !!this._cancellationTokens.get(request.seq));
                this._cancellationTokens.delete(request.seq);
            }
            else {
                vs = await this._runtime.getGlobalVariables();
            }
        }
        else if (v && Array.isArray(v.value)) {
            vs = v.value;
        }
        response.body = {
            variables: vs.map(v => this.convertFromRuntime(v))
        };
        this.sendResponse(response);
    }
    setVariableRequest(response, args) {
        const container = this._variableHandles.get(args.variablesReference);
        const rv = container === 'locals'
            ? this._runtime.setRegister(args.name, Number(args.value))
            : container instanceof RuntimeVariable && container.value instanceof Array
                ? container.value.find(v => v.name === args.name)
                : undefined;
        if (rv) {
            response.body = this.convertFromRuntime(rv);
        }
        this.sendResponse(response);
    }
    continueRequest(response, args) {
        this._runtime.continue();
        this.sendResponse(response);
    }
    nextRequest(response, args) {
        this._runtime.stepOver();
        this.sendResponse(response);
    }
    // Implemented as no-ops because they can't be deactivated.
    stepInRequest(response, args) {
        this._runtime.stepIn();
        this.sendResponse(response);
    }
    // Implemented as no-ops because they can't be deactivated.
    stepOutRequest(response, args) {
        this._runtime.stepOut();
        this.sendResponse(response);
    }
    async evaluateRequest(response, args) {
        let rv;
        rv = this._runtime.evaluate(args.expression);
        if (rv) {
            response.body = {
                result: rv.value.toString(),
                variablesReference: 0,
                presentationHint: { kind: 'data' },
            };
        }
        else {
            response.body = {
                result: 'Invalid register or address.',
                variablesReference: 0
            };
        }
        this.sendResponse(response);
    }
    dataBreakpointInfoRequest(response, args) {
        response.body = {
            dataId: null,
            description: "cannot break on data access",
            accessTypes: undefined,
            canPersist: false
        };
        if (args.variablesReference && args.name) {
            const v = this._variableHandles.get(args.variablesReference);
            if (v === 'globals') {
                response.body.dataId = args.name;
                response.body.description = args.name;
                response.body.accessTypes = ["write"];
                response.body.canPersist = true;
            }
            else {
                response.body.dataId = args.name;
                response.body.description = args.name;
                response.body.accessTypes = ["read", "write", "readWrite"];
                response.body.canPersist = true;
            }
        }
        this.sendResponse(response);
    }
    setDataBreakpointsRequest(response, args) {
        // clear all data breakpoints
        this._runtime.clearAllDataBreakpoints();
        response.body = {
            breakpoints: []
        };
        for (const dbp of args.breakpoints) {
            const ok = this._runtime.setDataBreakpoint(dbp.dataId, dbp.accessType || 'write');
            response.body.breakpoints.push({
                verified: ok
            });
        }
        this.sendResponse(response);
    }
    cancelRequest(response, args) {
        if (args.requestId) {
            this._cancellationTokens.set(args.requestId, true);
        }
        // if (args.progressId) {
        // 	this._cancelledProgressId= args.progressId;
        // }
    }
    pauseRequest(response, args) {
        // this._runtime.pause();
        this.sendResponse(response);
    }
    // protected disassembleRequest(response: DebugProtocol.DisassembleResponse, args: DebugProtocol.DisassembleArguments) {
    // 	const memoryInt = args.memoryReference.slice(3);
    // 	const baseAddress = parseInt(memoryInt);
    // 	const offset = args.instructionOffset || 0;
    // 	const count = args.instructionCount;
    // 	const isHex = memoryInt.startsWith('0x');
    // 	const pad = isHex ? memoryInt.length-2 : memoryInt.length;
    // 	const loc = this.createSource(this._runtime.sourceFile);
    // 	let lastLine = -1;
    // 	const instructions = this._runtime.disassemble(baseAddress+offset, count).map(instruction => {
    // 		let address = Math.abs(instruction.address).toString(isHex ? 16 : 10).padStart(pad, '0');
    // 		const sign = instruction.address < 0 ? '-' : '';
    // 		const instr : DebugProtocol.DisassembledInstruction = {
    // 			address: sign + (isHex ? `0x${address}` : `${address}`),
    // 			instruction: instruction.instruction
    // 		};
    // 		// if instruction's source starts on a new line add the source to instruction
    // 		if (instruction.line !== undefined && lastLine !== instruction.line) {
    // 			lastLine = instruction.line;
    // 			instr.location = loc;
    // 			instr.line = this.convertDebuggerLineToClient(instruction.line);
    // 		}
    // 		return instr;
    // 	});
    // 	response.body = {
    // 		instructions: instructions
    // 	};
    // 	this.sendResponse(response);
    // }
    setInstructionBreakpointsRequest(response, args) {
        // clear all instruction breakpoints
        this._runtime.clearInstructionBreakpoints();
        // set instruction breakpoints
        const breakpoints = args.breakpoints.map(ibp => {
            const address = parseInt(ibp.instructionReference.slice(3));
            const offset = ibp.offset || 0;
            return {
                verified: this._runtime.setInstructionBreakpoint(address + offset)
            };
        });
        response.body = {
            breakpoints: breakpoints
        };
        this.sendResponse(response);
    }
    customRequest(command, response, args) {
        if (command === 'toggleFormatting') {
            this._valuesInHex = !this._valuesInHex;
            if (this._useInvalidatedEvent) {
                this.sendEvent(new InvalidatedEvent(['variables']));
            }
            this.sendResponse(response);
        }
        else {
            super.customRequest(command, response, args);
        }
    }
    //---- helpers
    // private convertToRuntime(value: string): IRuntimeVariableType {
    // 	value= value.trim();
    // 	if (value === 'true') {
    // 		return true;
    // 	}
    // 	if (value === 'false') {
    // 		return false;
    // 	}
    // 	if (value[0] === '\'' || value[0] === '"') {
    // 		return value.substr(1, value.length-2);
    // 	}
    // 	const n = parseFloat(value);
    // 	if (!isNaN(n)) {
    // 		return n;
    // 	}
    // 	return value;
    // }
    convertFromRuntime(v) {
        let dapVariable = {
            name: v.name,
            value: '???',
            type: typeof v.value,
            variablesReference: 0,
            evaluateName: '$' + v.name
        };
        if (v.name.indexOf('lazy') >= 0) {
            // a "lazy" variable needs an additional click to retrieve its value
            dapVariable.value = 'lazy var'; // placeholder value
            v.reference ??= this._variableHandles.create(new RuntimeVariable('', [new RuntimeVariable('', v.value)]));
            dapVariable.variablesReference = v.reference;
            dapVariable.presentationHint = { lazy: true };
        }
        else {
            if (Array.isArray(v.value)) {
                dapVariable.value = 'Object';
                v.reference ??= this._variableHandles.create(v);
                dapVariable.variablesReference = v.reference;
            }
            else {
                switch (typeof v.value) {
                    case 'number':
                        if (Math.round(v.value) === v.value) {
                            dapVariable.value = this.formatNumber(v.value);
                            dapVariable.__vscodeVariableMenuContext = 'simple'; // enable context menu contribution
                            dapVariable.type = 'integer';
                        }
                        else {
                            dapVariable.value = v.value.toString();
                            dapVariable.type = 'float';
                        }
                        break;
                    case 'string':
                        dapVariable.value = `"${v.value}"`;
                        break;
                    case 'boolean':
                        dapVariable.value = v.value ? 'true' : 'false';
                        break;
                    default:
                        dapVariable.value = typeof v.value;
                        break;
                }
            }
        }
        if (v.memory) {
            v.reference ??= this._variableHandles.create(v);
            dapVariable.memoryReference = String(v.reference);
        }
        return dapVariable;
    }
    formatAddress(x, pad = 8) {
        return 'mem' + (this._addressesInHex ? '0x' + x.toString(16).padStart(8, '0') : x.toString(10));
    }
    formatNumber(x) {
        return this._valuesInHex ? '0x' + x.toString(16) : x.toString(10);
    }
    createSource(filePath) {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'reti-adapter-data');
    }
}
//# sourceMappingURL=retiDebugSession.js.map