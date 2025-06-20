import {
    abs,
    cos,
    noise3,
    noise5,
    saw,
    sgn,
    sin,
    tan,
    TAU,
    tri
} from "./math";

/** ZzFX oscillator. No tremolo, modulation, ADSR, filter, bitcrusher, or echo. */
export const zzfxOscillator = (sampleRate: number) => {
    var phase = 0;
    return (sampleNo: number, frequency: number, shape: number, shapeCurve = 1, noise = 0, phaseOffset = 0) => {
        const sample = (shape > 3 ? noise3 : shape > 2 ? tan : shape > 1 ? saw : shape ? tri : sin)(phaseOffset * TAU + (phase += (frequency * TAU / sampleRate) * (1 + noise * noise5(sampleNo))));
        return sgn(sample) * (abs(sample) ** shapeCurve);
    }
}

/** Biquad filter node, based on ZzFX's implementation.
 * filter param has the same meaning as there (greater than zero = highpass, less than zero = lowpass).
 * The init-time quality parameter controls the resonance of the filter (higher values = more resonance). */
export const biquadFilter = (sampleRate: number, quality = 2) => {
    var x2 = 0, x1 = 0, y2 = 0, y1 = 0;
    return (_: any, filter: number, sample: number) => {
        console.log("biquadFilter", filter, sample);
        // basically copied from ZzFX
        var w = TAU * abs(filter) * 2 / sampleRate,
            cos_ = cos(w), alpha = sin(w) / 2 / quality,
            a0 = 1 + alpha, a1 = -2 * cos_ / a0, a2 = (1 - alpha) / a0,
            b0 = (1 + sgn(filter) * cos_) / 2 / a0,
            b1 = -(sgn(filter) + cos_) / a0, b2 = b0;
        return y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = sample) - a2 * y2 - a1 * (y2 = y1);

    }
}

/** Bit crush in num samples */
export const bitcrusher = () => {
    var phase = 0, curSample = 0;
    return (_: any, crushSamples: number = 0, sample: number) =>
        (crushSamples > 0 && (phase = (phase + 1) % (crushSamples | 0)) >= 1) ? curSample : (curSample = sample);
}


/** Fixed delay. For echo and flanger effects. If feedbackGain is non-zero, the filter's output will be fed back into itself. Don't use a value greater than 1 for feedbackGain or you will get a horrible feedback shriek. */
export const delay = (sampleRate: number, delayTime: number) => {
    if (delayTime === 0) return (_: any, sample: number) => sample; // special case no delay
    const delaySamples = (sampleRate * delayTime) | 0;
    const buffer: number[] = new Array(delaySamples).fill(0);
    var i = 0;
    return (_: any, sample: number, feedbackGain = 0) => {
        const output = buffer[i]!;
        buffer[i] = sample + output * feedbackGain;
        i = (i + 1) % delaySamples;
        return output;
    }
}

/** Shimmer effect. Adds a random amount to the value, but only if the value has changed. The shimmer amount is relative to the value (0.05 = 5%). */
export const shimmerer = (_: any) => {
    var oldValue = 0, out = 0;
    return (_: any, value: number, shimmerAmount = .05) => {
        if (oldValue !== value) {
            out = value + (Math.random() - .5) * shimmerAmount * value;
            oldValue = value;
        }
        return out;
    }
}
