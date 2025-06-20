import { cos, PI } from "./math";
import type { NodeParameter, NodeTree } from "./types";
import { isNumber } from "./utils";

export const unisons = (oscTemplate: NodeTree, voices = 1, spread = 0, offset = 0, sign = 1, amp = 1, freqIndex = 1): NodeTree => {
    const out: Partial<NodeTree> = [];
    const baseFreq = oscTemplate[freqIndex];
    for (var i = 1; i <= voices; i++) {
        const selfOffset = (offset ?? 0) + (i > 1 ? -cos(PI * i) * ((i / 2) | 0) * spread : 0);
        const freqOffset = Math.pow(2, selfOffset / 12);
        out[i] = oscTemplate.with(freqIndex, isNumber(baseFreq) ? baseFreq * freqOffset : [[], baseFreq, freqOffset]);
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
