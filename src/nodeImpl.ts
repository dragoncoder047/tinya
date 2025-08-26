import { standardChannel } from "./channel";
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
import type { NodeImpl, NodeImplFactory } from "./types";
import { isUndefined } from "./utils";


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


/** Variable delay. For echo and flanger effects. If feedbackGain is non-zero, the delay line's output
 * will be fed back into itself. Don't use a value greater than 1 for feedbackGain or you will
 * get a horrible feedback shriek. */
export const delay = (sampleRate: number) => {
    var len = 1<<16;
    var buffer = new Float32Array(len);
    var pos = 0;
    return (_: any, delayTime: number, feedbackGain = 0, sample: number) => {
        const delaySamples = sampleRate * delayTime;
        // len is always a power of 2
        if (delaySamples > len) {
            var newLen = len << 1;
            const newBuffer = new Float32Array(len);
            // poor man's memcpy to make it wrap right
            // (.set() is just a singular memcpy with no wrapping)
            for (var i = 0; i < len; i++) newBuffer[i] = buffer[(pos + i) % len]!;
            buffer = newBuffer;
            pos = len;
            len = newLen;
        }
        const out = buffer[((pos + len - delaySamples) | 0) % len]!;
        buffer[pos] = sample + out * feedbackGain;
        pos = (pos + 1) % len;
        return out;
    }
}

/** Shimmer effect. Adds a random amount to the value, but only if the value has changed.
 * The shimmer amount is relative to the value (0.05 = 5%). */
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

export const clock = (sampleRate: number) => {
    var time = Infinity; // make it roll over on the first sample
    const dt = 1 / sampleRate;
    return (_: any, interval: number, speed = 1) => {
        time += dt * speed;
        if (time >= interval) {
            time = 0;
            return 1;
        }
        return 0;
    }
}

export const integrator = (sampleRate: number, initialValue = 0, sampleAccurate = 1) => {
    var integral = initialValue;
    return (_: number, integrand: number, reset = 0, resetTo?: number, wrapL?: number, wrapH?: number, clampL?: number, clampH?: number) => {
        integral += integrand / (sampleAccurate ? sampleRate : 1);
        if (!isUndefined(wrapL) && !isUndefined(wrapH)) {
            const difference = wrapH - wrapL;
            while (integral < wrapL) integral += difference;
            while (integral > wrapH) integral -= difference;
        }
        if (!isUndefined(clampH) && integral > clampH) integral = clampH;
        if (!isUndefined(clampL) && integral < clampL) integral = clampL;
        if (reset > 0) integral = resetTo ?? 0;
        return integral;
    }
}


// MAIN EXPORTS OBJECT
export const builtinNodes: Record<string, NodeImplFactory> = {
    g: gainMixer,
    rm: gainMixer, // ring modulator is just a multiplicative gain mixer lol
    a: summingMixer,
    w: zzfxOscillator,
    f: biquadFilter,
    b: bitcrusher,
    d: delay,
    sh: shimmerer,
    c: clock,
    i: integrator,
    ch: standardChannel as any,
};
