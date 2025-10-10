import { CompileState } from "../compiler/prog";

export enum MessageCode {
    SETUP_SYNTH,
    ADD_WAVETABLE,
    NOTE_ON,
    NOTE_OFF,
    PITCH_BEND,
    EXPRESSION,
    AUTOMATE
}

export type Message =
    [MessageCode.SETUP_SYNTH, instruments: [CompileState, CompileState][], postFX: CompileState] |
    [MessageCode.ADD_WAVETABLE, name: string, wave: Float32Array] |
    [MessageCode.NOTE_ON, id: number, instrument: number, pitch: number, expression: number] |
    [MessageCode.NOTE_OFF, id: number] |
    [MessageCode.PITCH_BEND, global: boolean, id: number, pitch: number, time: number] |
    [MessageCode.EXPRESSION, global: boolean, id: number, expression: number, time: number] |
    [MessageCode.AUTOMATE, instrument: number | undefined, param: string, value: any, duration: number];

// Sanity check:
let x: MessageCode = /* @__PURE__ */ null as any;
x satisfies Message[0];
