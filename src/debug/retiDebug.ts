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

    public constructor() {
        super("reti-debug-log.txt");

        this._emulator = new Emulator([], []);

        
    }
}