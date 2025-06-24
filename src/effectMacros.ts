import type { NodeParameter, NodeTree } from "./types";
import { gensym, isNumber } from "./utils";

// TODO nested macros are broken

export const unisons = (oscTemplate: NodeTree, voices = 1, spread = 0, offset = 0, sign = 1, amp = 1 / voices, freqIndex = 1): NodeTree => {
    const out: Partial<NodeTree> = ["add"];
    const baseFreq = oscTemplate[freqIndex];
    for (var i = 1; i <= voices; i++) {
        const offsetSemitones = offset + spread * (2 * (i - 1) / ((voices - 1) || 1) - .5);
        const offsetFactor = Math.pow(2, offsetSemitones / 12);
        out[i] = oscTemplate.with(freqIndex, isNumber(baseFreq) ? baseFreq * offsetFactor : ["gain", baseFreq, offsetFactor]) as NodeTree;
        if (i > 1 && sign !== 1) out[i] = ["gain", sign, out[i]];
    }
    return amp !== 1 ? ["gain", amp, out as NodeTree] : out as NodeTree;
}

export const combFilter = (input: NodeTree, delayTime: number, feedbackGain: NodeParameter = .9, feedforward = false): NodeTree => {
    const linkName = gensym("=combfilter_feed_");
    const outName = feedforward ? [] : [linkName];
    const inName = feedforward ? [linkName] : [];
    return [...outName, "add", [...inName, "add", input], ["gain", feedbackGain, [["delay", delayTime], "@" + linkName.slice(1)]]] as any;
}

// TODO: reverb effect

// TODO: FM synthesis

// MAIN MACROS OBJECT
export const builtinMacros: Record<string, (...args: any[]) => NodeTree> = {
    unison: unisons,
    combfilter: combFilter,
};
