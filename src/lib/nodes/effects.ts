import { NodeDef, NodeHelp, NodeValueType } from "../../compiler/evalState";
import { TAU, cos as cosine, sin, sqrt, tan } from "../../math";


enum FilterType {
    LOWPASS = 0,
    HIGHPASS = 1,
    PEAK = 2
}

export const filter: NodeDef = [
    "filter",
    [["sample", null], ["cutoff", null], ["resonance", 2], ["kind", 0]],
    NodeValueType.NORMAL_OR_MONO,
    [, , , { lowpass: 0, highpass: 1, peak: 2 }],
    () => {
        var x2 = 0, x1 = 0, y2 = 0, y1 = 0;
        return (dt, args) => {
            const sample = args[0]!, cutoff = args[1]!, resonance = args[2]!, kind: FilterType = args[3]!;
            const cornerRadiansPerSample = TAU * cutoff * dt;
            var alpha, a0, a1, a2, b0, b1, b2, sign, sqrtGain, bandwidth;
            const cos = cosine(cornerRadiansPerSample);
            switch (kind) {
                case FilterType.LOWPASS:
                case FilterType.HIGHPASS:
                    // low-pass and high-pass
                    alpha = sin(cornerRadiansPerSample) / 2 / resonance;
                    a0 = 1 + alpha;
                    sign = kind === FilterType.HIGHPASS ? -1 : 1;
                    a1 = -2 * cos / a0;
                    a2 = (1 - alpha) / a0;
                    b2 = b0 = (1 - cos * sign) / 2 / a0;
                    b1 = sign * 2 * b0;
                    break;
                case FilterType.PEAK:
                default:
                    // peak
                    sqrtGain = sqrt(resonance);
                    bandwidth = cornerRadiansPerSample / (sqrtGain < 1 ? 1 / sqrtGain : sqrtGain);
                    alpha = tan(bandwidth / 2);
                    a0 = 1 + alpha / sqrtGain;
                    b0 = (1 + alpha * sqrtGain) / a0;
                    b1 = a1 = -2 * cos / a0;
                    b2 = (1 - alpha * sqrtGain) / a0;
                    a2 = (1.0 - alpha / sqrtGain) / a0;
            }
            // this line copied from ZzFX.
            return y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = sample) - a2 * y2 - a1 * (y2 = y1);
        };
    }
];

export const filterHelp: NodeHelp = {
    description: "Biquad filter as implemented in BeepBox.",
    parameters: {
        cutoff: {
            range: [0, 10000],
            unit: "Hz",
        },
        quality: {
            range: [0, 100],
            description: "Affects the resonance of the filter. 1 means no resonance, >1 causes the filter to emphasize frequencies around the cutoff point, <1 causes the stopband slope to decrease and flatten. The default is 2 to match ZzFX's filter parameter."
        },
        kind: {
            description: "Selects what band the filter will process. A low-pass filter dampens frequencies higher than the cutoff, making the sound more muffled. A high-pass filter dampens frequencies below the cutoff, making the sound more tinny. A peak filter enhances or dampens frequencies close to the cutoff, adding or suppressing shrieks at that point.",
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
    description: "The classic low-fidelity effect produced by resampling the audio at a lower sample rate. Called 'frequency crush' in BeepBox.",
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
                const newBuffer = new Float32Array(newLen);
                // poor man's memcpy to make it wrap right
                // (.set() is just a singular memcpy with no wrapping and no length argument)
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
