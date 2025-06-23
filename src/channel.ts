import type { ChannelImpl } from "./types";

/*

this will get needed for the total length computation but whatever

SymPy version of the interpolation function:

a, b, d, t = symbols('a b d t', real=True, negative=False)
p = symbols('p', real=True)
f = Piecewise(
    (b + (a - b) * ((d - t) / d) ** -p, And(d > 0, p < 0)),
    (a + (b - a) * (t / d) ** p, And(d > 0, p >= 0)),
    (b, True)
)
F = simplify(integrate(f, (t, 0, d)))
F

SymPy says this -->

⎧             d⋅(-a + b⋅p)
⎪             ────────────                             for p < 0
⎪                p - 1
⎪
⎪  ⎛ p + 1                            ⎞
⎨d⋅⎝0     ⋅(a - b) + a⋅(p + 1) - a + b⎠
⎪──────────────────────────────────────  for (p > -1 ∧ p < 1) ∨ p > 1 ∨ p ≠ -1
⎪                p + 1
⎪
⎪                 nan                                  otherwise
⎩

can simplify this to {
    d * (a * p + b) / (p + 1) for p >= 0
    d * (b * p + a) / (1 - p) for p < 0
}

*/

const interpolationFunction = (t: number, p: number = 1, a: number, b: number, d: number) =>
    d > 0 ? (p < 0 ? (b + (a - b) * ((d - t) / d) ** -p) : (a + (b - a) * (t / d) ** p)) : b;


export type Channel = (number | undefined)[];

const splitTimings = (channel: Channel, sampleRate: number): [number[], number[], number[], number[]] => {
    const dts = [], ts = [], ps = [], vals = [];
    var t = 0;
    for (var i = 0; i < channel.length; i += 3) {
        const dt = ((channel[i] ?? 0) * sampleRate);
        dts.push(dt);
        ts.push(t);
        ps.push(channel[i + 1] ?? 1);
        vals.push(channel[i + 2] ?? 0);
        t += dt;
    }
    return [dts, ts, ps, vals];
}

export const standardChannel = (sampleRate: number, channel: Channel): ChannelImpl => {
    const [dts, ts, ps, vals] = splitTimings(channel, sampleRate);
    var i = 0;
    return (sampleNo: number) => {
        if (sampleNo >= ts.at(-1)! + dts.at(-1)!) return 0;
        while (sampleNo < ts[i]!) i--;
        while (sampleNo > ts[i]! + dts[i]!) i++;
        return interpolationFunction(sampleNo - ts[i]!, ps[i], vals[i - 1] ?? 0, vals[i]!, dts[i]!);
    }
}

export const makeADSRChannel = (attack = 0, decay = 0, sustain = 0, sustainVol = 1, release = .1, gateChannel = 0, behavior = 5): Channel =>
    [...(sustain < 0 ? [, -gateChannel, behavior] : []), attack, , 1, decay, , sustainVol, sustain, , sustainVol, release]

export const adsrNode = (sampleRate: number, ...params: Parameters<typeof makeADSRChannel>): ChannelImpl => {
    return standardChannel(sampleRate, makeADSRChannel(...params));
}

export const channelDuration = (channel: Channel): number => {
    const [dts, ts] = splitTimings(channel, 1);
    return ts.at(-1)! + dts.at(-1)!;
}

// TODO: BPM / tempo channel and articulation channel
