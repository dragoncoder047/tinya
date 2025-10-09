import { NodeDef } from "./evalState";

export enum Opcode {
    /** next is the constant */
    PUSH_CONSTANT,
    DROP_TOP,
    PUSH_FRESH_EMPTY_LIST,
    APPEND_TO_LIST,
    EXTEND_TO_LIST,
    /** next is opcode */
    DO_BINARY_OP,
    /** next is opcode */
    DO_UNARY_OP,
    /** next is register no. */
    GET_REGISTER,
    /** next is register no. */
    TAP_REGISTER,
    CONDITIONAL_SELECT,
    /** doubles the sample into a [sample, sample] left right pair */
    STEREO_DOUBLE_WIDEN,
    /** next 2 is node no, argc */
    APPLY_NODE,
    /** next 3 is node no A and B, argc */
    APPLY_DOUBLE_NODE_STEREO,
    /** next is input name, returns 0 if doesn't exist */
    GET_INPUT,
}

export type Program = (Opcode | number | string)[];

export interface CompileState {
    p: Program;
    r: string[];
    nn: string[];
    mod: string[];
    tosStereo: boolean;
    ni: NodeDef[];
}

export function allocRegister(name: string, state: CompileState): number {
    const i = state.r.indexOf(name);
    if (i === -1) return state.r.push(name) - 1;
    return i;
}
export function allocNode(name: string, state: CompileState): number {
    return state.nn.push(name) - 1;
}
