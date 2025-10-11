import { NodeDef, NodeHelp, NodeValueType } from "../../compiler/evalState";
import { TAU, abs, cos, sin, sgn } from "../../math";


export const zzfxFilter: NodeDef = [
    "zzfxFilter",
    [["sample", null], ["cutoff", null], ["quality", 2]],
    NodeValueType.NORMAL_OR_MONO,
    [],
    () => {
        var x2 = 0, x1 = 0, y2 = 0, y1 = 0;
        return (dt, args) => {
            const sample = args[0]!, cutoff = args[1]!, quality = args[2]!;
            // basically copied from ZzFX
            var w = TAU * abs(cutoff) * 2 * dt,
                cos_ = cos(w), alpha = sin(w) / 2 / quality,
                a0 = 1 + alpha, a1 = -2 * cos_ / a0, a2 = (1 - alpha) / a0,
                b0 = (1 + sgn(cutoff) * cos_) / 2 / a0,
                b1 = -(sgn(cutoff) + cos_) / a0, b2 = b0;
            return y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = sample) - a2 * y2 - a1 * (y2 = y1);

        };
    }
];

export const zzfxFilterHelp: NodeHelp = {
    description: "Combination biquad low-pass / high-pass filter as implemented in ZzFX.",
    parameters: {
        cutoff: {
            range: [-10000, 10000],
            unit: "Hz",
            description: "The cutoff frequency of the filter. The sign decides between high-pass (>=0) and low-pass (<0) and the magnitude is the cutoff frequency."
        },
        quality: {
            range: [0, 100],
            description: "Affects the resonance of the filter."
        }
    }
};

export const bitcrusher: NodeDef = [
    "bitcrusher",
    [["sample", null], ["sampleRate", 8000]],
    NodeValueType.NORMAL_OR_MONO,
    [],
    () => {
        var phase = 0, last = 0;
        return (dt, args) => {
            const sample = args[0]!, bitcrushSampleRate = args[1]!;
            phase += bitcrushSampleRate * dt;
            if (phase >= 1) {
                phase -= (phase | 0);
                last = sample;
            }
            return last;
        };
    }
];

export const bitcrusherHelp: NodeHelp = {
    description: "The classic low-fidelity effect produced by resampling the audio at a lower sample rate.",
    parameters: {
        sampleRate: {
            range: [1, 48000],
            unit: "Hz",
        },
    }
}

export const delay: NodeDef = [
    "delay",
    [["sample", null], ["time", 0]],
    NodeValueType.NORMAL_OR_MONO,
    [],
    () => {
        var len = 1 << 14; // ~ 0.3 seconds of audio at 48kHz
        var buffer = new Float32Array(len);
        var pos = 0;
        return (dt, args) => {
            const sample = args[0]!, delayTime = args[1]!;
            const delaySamples = delayTime / dt;
            // len is always a power of 2
            if (delaySamples > len) {
                var newLen = len << 1;
                const newBuffer = new Float32Array(len);
                // poor man's memcpy to make it wrap right
                // (.set() is just a singular memcpy with no wrapping)
                for (var i = 0; i < len; i++) newBuffer[i] = buffer[(pos + i) & (len - 1)]!;
                buffer = newBuffer;
                pos = len;
                len = newLen;
            }
            const out = buffer[(pos + len - delaySamples) & (len - 1)]!;
            buffer[pos] = sample;
            pos = (pos + 1) & (len - 1);
            return out;
        }
    }
];

export const delayHelp: NodeHelp = {
    description: "Singular delay line. No self-feedback or interpolation between samples.",
    parameters: {
        time: {
            range: [0, 100],
            unit: "seconds",
            description: "How long to delay the sample for. Changing this mid-delay will effectively pitch-shift the buffered samples"
        }
    }
};

// TODO: comb filter macros, allpass filter macros, reverb macros
// https://medium.com/the-seekers-project/coding-a-basic-reverb-algorithm-part-2-an-introduction-to-audio-programming-4db79dd4e325
