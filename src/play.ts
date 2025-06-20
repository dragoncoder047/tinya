import { standardChannel, type Channel } from "./channel";
import { type CompiledInstrument } from "./types";
import { isNotNegative, isNumber } from "./utils";

export const buildSamples = (instrument: CompiledInstrument, channels: Channel[], duration: number, sampleRate = 44100): number[] => {
    const samples: number[] = [],
        [registers, instructions, nodeFactories] = instrument,
        nodes = nodeFactories.map(([factory, args]) => factory(sampleRate, ...args)),
        numSamples = duration * sampleRate,
        // TODO: switch this for different kinds of channel once those are implemented
        inputChannels = channels.map(c => standardChannel(sampleRate, c)),
        channelValues: number[] = [],
        stack: number[] = [];
    var i, sampleNo;
    for (sampleNo = 0; sampleNo < numSamples; sampleNo++) {
        // do the input channels
        channelValues.length = 0;
        for (i = 0; i < inputChannels.length; i++)
            channelValues.push(inputChannels[i]!(sampleNo, ...channelValues));
        // do the node graph
        stack.length = 0;
        for (i = 0; i < instructions.length; i++) {
            const inst = instructions[i]!;
            if (isNumber(inst)) {
                if (isNotNegative(inst))
                    registers[inst] = stack.at(-1)!;
                else
                    stack.push(registers[-inst]!)
            } else {
                const [nodeIndex, numArgs] = inst;
                if (isNotNegative(nodeIndex))
                    stack.push(nodes[nodeIndex]!(sampleNo, ...stack.splice(stack.length - numArgs!, numArgs)));
                else
                    stack.push(channelValues[-nodeIndex]! ?? 0);
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
