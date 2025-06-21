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
import { NodeImpl, NodeImplFactory } from "./types";


/** constant node - discards all its inputs and returns the value passed to the constructor */
export const constant = (_: number, num: number): NodeImpl => () => num;

/** summing mixer - sums all its inputs and returns the result (0 if no inputs) */
export const summingMixer = (): NodeImpl => (_, ...args) => args.reduce((a, b) => a + b, 0);
/** gain mixer - multiplies all its inputs and returns the result (1 if no inputs) */
export const gainMixer = (): NodeImpl => (_, ...args) => args.reduce((a, b) => a * b, 1);


/** ZzFX oscillator with 5th power noise. No tremolo, modulation, ADSR, filter, bitcrusher, or echo.
 * Shape is 0 = sine, 1 = triangle, 2 = sawtooth, 3 = tan (sounds like 2x frequency), 4 = cube noise. */
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
    return (_: any, crushSamples: number = 0, sample: number) => {
        if (++phase >= crushSamples) {
            phase = 0;
            curSample = sample;
        }
        return curSample;
    }
}


/** Fixed delay. For echo and flanger effects. If feedbackGain is non-zero, the filter's output will be fed back into itself. Don't use a value greater than 1 for feedbackGain or you will get a horrible feedback shriek. */
export const delay = (sampleRate: number, delayTime: number) => {
    if (delayTime === 0) return (_: any, sample: number) => sample; // special case no delay
    const delaySamples = (sampleRate * delayTime) | 0;
    const buffer: number[] = new Array(delaySamples).fill(0);
    var i = 0;
    return (_: any, sample: number, feedbackGain = 0) => {
        // TODO: variable delay time (if less than buffer length, advance read in next line by bufLen-delayTime samples, if too long resize buffer)
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


// MAIN EXPORTS OBJECT
export const builtinNodes: Record<string, NodeImplFactory> = {
    gain: gainMixer,
    ringmod: gainMixer, // ring modulator is just a multiplicative gain mixer lol
    add: summingMixer,
    wave: zzfxOscillator,
    filter: biquadFilter,
    bitcrush: bitcrusher,
    delay: delay,
    shimmer: shimmerer,
};
