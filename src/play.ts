import { standardChannel, type Channel } from "./channel";
import { type CompiledInstrument } from "./types";
import { isInputRef, isNodeName, isNotNegative, isNumber, isRef, mapObject } from "./utils";

export const buildSamples = (instrument: CompiledInstrument, channels: Record<string, Channel>, duration: number, sampleRate = 44100): number[] => {
    const samples: number[] = [],
        [instructions, nodeFactories] = instrument,
        registers: Record<string, number> = {},
        nodes = nodeFactories.map(([factory, args]) => factory(sampleRate, ...args)),
        numSamples = duration * sampleRate,
        // TODO: switch this for different kinds of channel once those are implemented
        inputChannels = mapObject(channels, channel => standardChannel(sampleRate, channel)),
        stack: number[] = [];
    var channelValues: Record<string, number> = {};
    var i, sampleNo;
    for (sampleNo = 0; sampleNo < numSamples; sampleNo++) {
        // do the input channels
        channelValues = {};
        for (i of Object.keys(inputChannels)) {
            channelValues[i] = inputChannels[i]!(sampleNo, channelValues);
        }
        // do the node graph
        stack.length = 0;
        for (i = 0; i < instructions.length; i++) {
            const inst = instructions[i]!;
            if (isNodeName(inst)) {
                registers[inst.slice(1)] = stack.at(-1)!;
            } else if (isRef(inst)) {
                stack.push(registers[inst.slice(1)] ?? 0);
            } else if (isInputRef(inst)) {
                stack.push(channelValues[inst.slice(1)] ?? 0);
            } else {
                if (inst.length === 1)
                    stack.push(inst[0]);
                else {
                    const [nodeIndex, numArgs] = inst;
                    if (isNotNegative(nodeIndex))
                        stack.push(nodes[nodeIndex]!(sampleNo, ...stack.splice(stack.length - numArgs!, numArgs)));
                    else
                        stack.push(channelValues[-nodeIndex]! ?? 0);
                }
            }
        }
        const sample = stack.pop()!;
        if (!isNumber(sample))
            throw new Error(`got NaN sample at sampleNo=${sampleNo}`);
        samples.push(sample);
    }
    return samples;
}

export const toBufferNode = (samples: number[][] | number[], audioCtx: AudioContext, sampleRate = 44100): AudioBufferSourceNode => {
    const normSamples = isNumber(samples[0]) ? [samples as number[]] : samples as number[][],
        buffer = audioCtx.createBuffer(normSamples.length, normSamples[0]!.length, sampleRate),
        source = audioCtx.createBufferSource();
    normSamples.map((d, i) => buffer.getChannelData(i).set(d));
    source.buffer = buffer;
    return source;
}
