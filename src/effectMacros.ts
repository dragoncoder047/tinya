import type { NodeParameter, NodeTree } from "./types";
import { isNumber } from "./utils";

export const unisons = (oscTemplate: NodeTree, voices = 1, spread = 0, offset = 0, sign = 1, amp = 1, freqIndex = 1): NodeTree => {
    const out: Partial<NodeTree> = [];
    const baseFreq = oscTemplate[freqIndex];
    for (var i = 1; i <= voices; i++) {
        const offsetSemitones = offset + spread * (i - 1) / voices;
        const offsetFactor = Math.pow(2, offsetSemitones / 12);
        out[i] = oscTemplate.with(freqIndex, isNumber(baseFreq) ? baseFreq * offsetFactor : [[], baseFreq, offsetFactor]);
        if (i > 1 && sign !== 1) out[i] = [[], sign, out[i]];
    }
    return amp !== 1 ? [[], amp, out as NodeTree] : out as NodeTree;
}

export const combFilter = (input: NodeTree, delayTime: number, feedbackGain: NodeParameter = .9, feedforward = false, delayName = "d", delaySampleInputIndex = 1): NodeTree => {
    const delayLine: NodeTree = [[delayName, delayTime]];
    delayLine[delaySampleInputIndex] = feedforward ? [-2, 0] : [-2];
    return [, input, [[], feedbackGain, delayLine]];
}

// TODO: reverb effect

// TODO: FM synthesis
