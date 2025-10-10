// export const unisons = (oscTemplate: NodeTree, voices = 1, spread = 0, offset = 0, sign = 1, amp = 1 / voices, freqIndex = 1): NodeTree => {
//     const out: Partial<NodeTree> = ["a"];
//     const baseFreq = oscTemplate[freqIndex];
//     for (var i = 1; i <= voices; i++) {
//         const offsetSemitones = offset + spread * (2 * (i - 1) / ((voices - 1) || 1) - .5);
//         const offsetFactor = Math.pow(2, offsetSemitones / 12);
//         out[i] = oscTemplate.with(freqIndex, isNumber(baseFreq) ? baseFreq * offsetFactor : ["g", baseFreq, offsetFactor]) as NodeTree;
//         if (i > 1 && sign !== 1) out[i] = ["g", sign, out[i]];
//     }
//     return amp !== 1 ? ["g", amp, out as NodeTree] : out as NodeTree;
// }

// export const combFilter = (input: NodeTree, delayTime: number, feedbackGain: NodeParameter = .9, feedforward = false): NodeTree => {
//     const linkName = gensym("=cff_");
//     const outName = feedforward ? [] : [linkName];
//     const inName = feedforward ? [linkName] : [];
//     return [...outName, "a", [...inName, "a", input], ["g", feedbackGain, ["d", delayTime, , "@" + linkName.slice(1)]]] as any;
// }

// TODO: reverb effect

/*

TODO: FM synthesis

each operator = [freqMul, gain, modulatedBy or [modulatedBy, overrideGain], outGain, hzOffset]

so for example: guitar defined as 1<-(2 3<-4), 1=~1x 100%, 2=1x 75%, 3=1x 60%, 4=~2x 25%, feedback = 1->2 25%
would be: [[,,[2,3,4],1,5],[,.75,[[1,.25]],0],[,.25,[4],0,5],[2,.25,,0,5]]

*/

