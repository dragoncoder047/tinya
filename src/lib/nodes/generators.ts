import { NodeDef, NodeHelp, NodeValueType } from "../../compiler/evalState";
import { abs, noise3, noise5, saw, sgn, sin, tan, TAU, tri } from "../../math";

export const zzfxOscillator: NodeDef = [
    "zzfxOscillator",
    [["frequency", null], ["shape", 0], ["distortion", 1], ["noise", 0], ["phaseMod", 0]],
    NodeValueType.NORMAL_OR_MONO,
    [, { sine: 0, triangle: 1, sawtooth: 2, tangent: 3, noise3: 4 }],
    () => {
        var phase = 0, sampleNo = 0;
        return (dt, args) => {
            const frequency = args[0]!, shape = args[1]!, distortion = args[2]!, noise = args[3]!, phaseMod = args[4]!;
            const sample = (shape > 3 ? noise3 : shape > 2 ? tan : shape > 1 ? saw : shape ? tri : sin)(phaseMod * TAU + (phase += (frequency * TAU * dt) * (1 + noise * noise5(sampleNo++))));
            return sgn(sample) * (abs(sample) ** distortion);
        }
    }
];
export const zzfxOscillatorHelp: NodeHelp = {
    description: "Multi-waveform oscillator like that of ZzFX.",
    parameters: {
        frequency: {
            unit: "Hz",
            range: [0, 20000],
        },
        shape: {
            description: "Which base shape of oscillator to start with. Note: tangent wave sounds like double the desired frequency."
        },
        distortion: {
            range: [0, 10],
            description: "How much to distort the wave shape by. A value of 0 returns a 50% duty cycle squarewave with the same frequency as the original, a value of 1 returns the real shape unchanged, and large values warp the wave towards the alternating Dirac comb function (and aliasing is increasingly likely)"
        },
        noise: {
            range: [0, 100],
            description: "How much extra noise to add to the wave.",
        },
        phaseMod: {
            range: [0, 1],
            unit: "cycles (NOT radians!)",
            description: "Modulates the oscillator's phase without adding to the internal accumulator. Useful for FM synthesis."
        }
    }
};
