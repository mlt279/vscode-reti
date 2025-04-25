import { Logger,
    logger,
    LoggingDebugSession,
    InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent,
    ProgressStartEvent, ProgressUpdateEvent, ProgressEndEvent, InvalidatedEvent,
    Thread, StackFrame, Scope, Source, Handles, Breakpoint, MemoryEvent
} from '@vscode/debugadapter';

import { DebugProtocol } from '@vscode/debugprotocol';

import { Emulator } from '../reti/emulator';

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
    stopOnEntry?: boolean;
}

interface IAttachRequestArguments extends ILaunchRequestArguments {}

export class ReTIDebugSession extends LoggingDebugSession {
    private static threadID = 42;

    private _cancellationTokens = new Map<number, boolean>();

    private _emulator: Emulator;

    private _breakpoints = new Set<number>;

    public constructor() {
        super("reti-debug-log.txt");

        this._emulator = new Emulator([], []);
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse): void {
        response.body = response.body || {};
        response.body.supportsCancelRequest = true;

        response.body.supportsSetVariable = true;
        response.body.supportsReadMemoryRequest = true;
        response.body.supportsWriteMemoryRequest = true;

        response.body.supportsInstructionBreakpoints = true;
    }

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse): Promise<void> {
        logger.setup(Logger.LogLevel.Verbose, true);

        this.sendErrorResponse(response, {
            id: 69,
            format: 'Fake error',
            showUser: true
        });
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }
}