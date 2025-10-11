import * as AST from "../compiler/ast";
import { EvalState, NodeDef, NodeHelp } from "../compiler/evalState";
import { CompiledVoiceData, Opcode } from "../compiler/prog";
import { ast as lib, sources } from "./index.syd";
import { bitcrusher, bitcrusherHelp, delay, delayHelp, zzfxFilter, zzfxFilterHelp } from "./nodes/effects";
import { zzfxOscillator, zzfxOscillatorHelp } from "./nodes/generators";
import { clock, clockHelp, integrator, integratorHelp, shimmered, shimmeredHelp } from "./nodes/logic";
export { sources as libSrc };

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

export function newCompileData(): CompiledVoiceData {
    return {
        p: [],
        r: [],
        nn: [],
        tosStereo: false,
        mods: [],
    }
}

export function silenceInstrument(): CompiledVoiceData {
    return {
        p: [Opcode.PUSH_CONSTANT, [0, 0]],
        r: [],
        nn: [],
        tosStereo: true,
        mods: []
    }
}
export function passthroughFx(): CompiledVoiceData {
    return {
        p: [Opcode.PUSH_INPUT_SAMPLES],
        r: [],
        nn: [],
        tosStereo: true,
        mods: []
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
export async function newEnv() {
    const env = baseEnv();
    await (lib as AST.Node).eval(env);
    return env;
}
export async function compileInstrument(source: string, filename: string) {

}
