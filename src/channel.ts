import type { ChannelImpl } from "./types";


/*

channel header:
    undefined or none (number first) = normal or multitrack channel
        next is undefined or array of track names
    t = tempo channel
        integrated; time values are in beats, output values are in BPM
    m = morph channel
        next input is number of morph targets
    e = envelope (gated) channel
        next header field is which input is the gate
        can only have 1 track, and a time value of -1 specifies hold while gate on





*/

export type Channel = (number | undefined)[];

const splitTimings = (channel: Channel, sampleRate: number): [number[], number[], number[]] => {
    const dts = [], ts = [], vals = [];
    var t = 0;
    for (var i = 0; i < channel.length; i += 2) {
        const dt = ((channel[i] ?? 0) * sampleRate);
        dts.push(dt);
        ts.push(t);
        vals.push(channel[i + 1] ?? 0);
        t += dt;
    }
    return [dts, ts, vals];
}

const interpolate = (t: number, a: number, b: number, d: number) =>
    d <= 0 ? b : a + (b - a) * (t / d);

export const standardChannel = (sampleRate: number, channel: Channel): ChannelImpl => {
    const [dts, ts, vals] = splitTimings(channel.slice(2), sampleRate);
    var i = 0;
    return (sampleNo: number) => {
        if (sampleNo >= ts.at(-1)! + dts.at(-1)!) return 0;
        while (sampleNo < ts[i]!) i--;
        while (sampleNo > ts[i]! + dts[i]!) i++;
        return interpolate(sampleNo - ts[i]!, vals[i - 1] ?? 0, vals[i]!, dts[i]!);
    }
}

export const makeADSRChannel = (attack = 0, decay = 0, sustain = 0, sustainVol = 1, release = .1): Channel =>
    [, , attack, 1, decay, sustainVol, sustain, sustainVol, release]

export const adsrNode = (sampleRate: number, ...params: Parameters<typeof makeADSRChannel>): ChannelImpl => {
    return standardChannel(sampleRate, makeADSRChannel(...params));
}

export const channelDuration = (channel: Channel): number => {
    const [dts, ts] = splitTimings(channel, 1);
    return ts.at(-1)! + dts.at(-1)!;
}
