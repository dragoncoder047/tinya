import { isArray, isinstance, id } from "../utils";
import { Node, Value } from "./ast";
import { NodeDef } from "./evalState";
import { allocRegister, CompiledVoiceData, Opcode, Program } from "./prog";


export function newCompileData(): CompiledVoiceData {
    return {
        p: [],
        r: [],
        nn: [],
        tosStereo: false,
        mods: [],
    };
}

export function makeStereoAtIndex(prog: Program, index: number = prog.length) {
    const entryThere = prog[index - 1]!;
    if (entryThere[0] === Opcode.PUSH_CONSTANT && !isArray(entryThere[1])) {
        entryThere[1] = [entryThere[1] as number, entryThere[1] as number];
    } else {
        prog.splice(index, 0, [Opcode.STEREO_DOUBLE_WIDEN]);
    }
}

export type ResultCacheEntry = {
    s: boolean;
    t: [Opcode.NOOP | Opcode.TAP_REGISTER, reg?: number];
};

export function compileNode(node: Node, state: CompiledVoiceData, cache: Map<Node, ResultCacheEntry>, ni: NodeDef[]): CompiledVoiceData {
    if (isinstance(node, Value)) {
        node.compile(state);
        return state;
    }
    const entry = cache.get(node);
    const regname = "" + id(node);
    if (entry) {
        entry.t[0] = Opcode.TAP_REGISTER;
        entry.t[1] = allocRegister(regname, state);
        state.p.push([Opcode.GET_REGISTER, allocRegister(regname, state)]);
        state.tosStereo = entry.s;
    }
    else {
        const myEntry: ResultCacheEntry = { s: false, t: [Opcode.NOOP] };
        cache.set(node, myEntry);
        node.compile(state, cache, ni);
        myEntry.s = state.tosStereo;
        state.p.push(myEntry.t);
    }
    return state;
}

export function optimizeProgram(state: CompiledVoiceData): CompiledVoiceData {
    state.p = state.p.filter(i => i[0] !== Opcode.NOOP);
    return state;
}
