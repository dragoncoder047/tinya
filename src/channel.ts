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

what about multiple notes in the chord

generalization of notes: each note entry is a list of time step, for each time event it has
[pitch, expression] pairs like in a channel, and interpolation is the same, if undefined
the interpolation step is omitted and it just takes the intermediate value from the surrounding
defined events

beepbox stores each of the notes vertically: there is only ever zero or one active Note at once
in each channel, and the Note stores a list of base pitches. Then there is a list of NotePins
that have the pitch bend and expression data and the pins apply to *all* of the notes in the chord
simultaneously. This is kind of dumb because you should be able to have notes continue at the same time
another note starts, as well as some notes pitch bend and others not, without duplicating the same
instrument across multiple channels (and then risk editing the instrument in one place and
forgetting to update it in the copy channels). I had this problem with the white synths in my
Heavy Light cover towards the end of it. The white synth does chords/pad, but also doubles the
purple synth's melody in the bass which doesn't have the same note breaks so I couldn't use
"continue" transition mode.




*/

export type Channel = (number | undefined)[];

const splitTimings = (channel: Channel, sampleRate: number): [number[], number[], number[]] => {
    const dts = [0], ts = [0], vals = [0];
    var t = 0;
    for (var i = 0; i < channel.length; i += 2) {
        const dt = ((channel[i] ?? 0) * sampleRate);
        dts.push(dt);
        ts.push(t);
        vals.push(channel[i + 1] ?? vals.at(-1)!);
        t += Math.abs(dt);
    }
    return [dts, ts, vals];
}

const interpolate = (t: number, a: number, b: number, d: number) =>
    d <= 0 ? b : a + (b - a) * (t / d);

export const standardChannel = (sampleRate: number, channel: Channel): ChannelImpl => {
    const [dts, ts, vals] = splitTimings(channel, sampleRate);
    var i = 0;
    return (sampleNo: number) => {
        if (sampleNo >= ts.at(-1)! + dts.at(-1)!) return 0;
        while (sampleNo < ts[i]!) i--;
        while (sampleNo > ts[i]! + dts[i]!) i++;
        return interpolate(sampleNo - ts[i]!, vals[i - 1] ?? 0, vals[i]!, dts[i]!);
    }
}

export const makeADSRChannel = (attack = 0, decay = 0, sustain = 0, sustainVol = 1, release = .1): Channel =>
    [attack, 1, decay, sustainVol, sustain, sustainVol, release]

export const adsrNode = (sampleRate: number, ...params: Parameters<typeof makeADSRChannel>): ChannelImpl => {
    return standardChannel(sampleRate, makeADSRChannel(...params));
}

export const channelDuration = (channel: Channel): number => {
    const [dts, ts] = splitTimings(channel, 1);
    return ts.at(-1)! + dts.at(-1)!;
}
