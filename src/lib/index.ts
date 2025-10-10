import { EvalState, NodeDef, NodeHelp } from "../compiler/evalState";
import { CompileState } from "../compiler/prog";
import { bitcrusher, bitcrusherHelp, delay, delayHelp, zzfxFilter, zzfxFilterHelp } from "./nodes/effects";
import { zzfxOscillator, zzfxOscillatorHelp } from "./nodes/generators";
import { clock, clockHelp, integrator, integratorHelp, shimmered, shimmeredHelp } from "./nodes/logic";

export function nodes(): NodeDef[] {
    return [
        zzfxOscillator,
        zzfxFilter,
        bitcrusher,
        delay,
        shimmered,
        integrator,
        clock,
    ]
}

export function baseEnv(): EvalState {
    return {
        globalEnv: {},
        env: {},
        functions: [],
        nodes: nodes(),
        callstack: [],
        recursionLimit: 1000,
        // TODO
        annotators: {},
    };
}

export function baseCompileState(): CompileState {
    return {
        p: [],
        r: [],
        nn: [],
        tosStereo: false,
        mods: [],
    }
}

export function nodeHelp(): Record<string, NodeHelp> {
    return {
        zzfxOscillator: zzfxOscillatorHelp,
        zzfxFilter: zzfxFilterHelp,
        bitcrusher: bitcrusherHelp,
        delay: delayHelp,
        shimmered: shimmeredHelp,
        integrator: integratorHelp,
        clock: clockHelp
    }
}
