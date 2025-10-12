import { AutomatedValueMethod } from "../runtime/automation";

export enum Opcode {
    /** next is the constant */
    PUSH_CONSTANT,
    PUSH_INPUT_SAMPLES,
    PUSH_PITCH,
    PUSH_EXPRESSION,
    PUSH_GATE,
    MARK_STILL_ALIVE,
    PUSH_FRESH_EMPTY_LIST,
    APPEND_TO_LIST,
    EXTEND_TO_LIST,
    /** next is opcode */
    DO_BINARY_OP,
    DO_BINARY_OP_STEREO,
    /** next is opcode */
    DO_UNARY_OP,
    DO_UNARY_OP_STEREO,
    /** next is register no. */
    GET_REGISTER,
    /** next is register no. */
    TAP_REGISTER,
    SHIFT_REGISTER,
    CONDITIONAL_SELECT,
    /** doubles the sample into a [sample, sample] left right pair */
    STEREO_DOUBLE_WIDEN,
    /** next 2 is node no, argc */
    APPLY_NODE,
    /** next 3 is node no A and B, argc */
    APPLY_DOUBLE_NODE_STEREO,
    /** next is input number, returns 0 if doesn't exist */
    GET_MOD,
}

type Command = [Opcode, a?: number | string | [number, number], b?: number, c?: number];
export type Program = Command[];

export interface CompiledVoiceData {
    p: Program;
    r: string[];
    nn: string[];
    tosStereo: boolean;
    mods: [name: string, initial: number, mode: AutomatedValueMethod][]
}

export function allocRegister(name: string, state: CompiledVoiceData): number {
    const i = state.r.indexOf(name);
    if (i === -1) return state.r.push(name) - 1;
    return i;
}
export function allocNode(name: string, state: CompiledVoiceData): number {
    return state.nn.push(name) - 1;
}

export function allocMod(name: string, state: CompiledVoiceData, initial: number, mode: AutomatedValueMethod): number {
    return state.mods.push([name, initial, mode]) - 1;
}
