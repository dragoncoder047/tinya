import { NodeDef, NodeHelp, NodeValueType } from "../compiler/env";
export const shimmered: NodeDef = [
    "shimmered",
    [["value", 0], ["amount", 0.05]],
    NodeValueType.NORMAL,
    [],
    () => {
        var oldValue = 0, out = 0;
        return (dt, args) => {
            const value = args[0]!, amount = args[1]!;
            if (oldValue !== value) {
                out = value + (Math.random() - .5) * amount * value;
                oldValue = value;
            }
            return out;
        }
    }
];

export const shimmeredHelp: NodeHelp = {
    description: "Each time the input value changes, perturbs it by a small amount. No noise is added.",
    parameters: {
        amount: {
            unit: "fraction of value",
            range: [0, 1]
        }
    }
};
export const integrator: NodeDef = [
    "integrate",
    [["derivative", 0], ["resetClock", 0], ["resetValue", 0], ["boundaryMode", 1], ["low", -Infinity], ["high", Infinity], ["sampleMode", 1]],
    NodeValueType.NORMAL,
    [, , , { clamp: 1, wrap: 0 }, , , { integrate: 1, accumulate: 0 }],
    () => {
        var integral = 0, prevReset = 0;
        return (dt, args) => {
            const integrand = args[0]!, reset = args[1]!, resetTo = args[2]!, boundaryMode = args[3]!, low = Math.min(args[4]!, args[5]!), high = Math.max(args[4]!, args[5]!), sampleMode = args[6]!;
            if (reset > 0 && prevReset <= 0) integral = resetTo;
            prevReset = reset;
            integral += integrand * (sampleMode ? dt : 1);
            const difference = high - low;
            if (boundaryMode === 0 && difference > 0) {
                while (integral < low) integral += difference;
                while (integral > high) integral -= difference;
            } else {
                if (integral < low) integral = low;
                if (integral > high) integral = high;
            }
            return integral;
        }
    }
];

export const integratorHelp: NodeHelp = {
    description: "An integrator/accumulator which can be used to sweep a value at a variable speed.",
    parameters: {
        resetClock: {
            description: "When this changes from 0 to 1, the internal integrand is reset instantly to resetValue. A 1 on the very first sample triggers a reset as well."
        },
        boundaryMode: {
            description: "If boundaryMode is 0 (wrap), the integrand will jump down to low when it passes high, and vice versa. If boundaryMode is 1 (clamp), the integrand will saturate when it reaches high or low."
        },
        sampleMode: {
            description: "If sampleMode is 1 (integrate) the derivative value will be treated as a value with units, and will be scaled by the sample rate - useful when it is a continuous value varying in real units with time. If sampleMode is 0 (accumulate) the derivative value will not be scaled and will be added on every sample - this is useful in combination with the clock node to create a stepping motion."
        }
    }
};

export const clock: NodeDef = [
    "clock",
    [["period", 1], ["speed", 1]],
    NodeValueType.NORMAL,
    [],
    () => {
        var time = Infinity;
        return (dt, args) => {
            const period = args[0]!, speedScale = args[1]!;
            time += speedScale * dt;
            if (time >= period) {
                time = 0;
                return 1;
            }
            return 0;
        }
    }
];

export const clockHelp: NodeHelp = {
    description: "A clock, that counts time internally and outputs 1 when the timer rolls over, and 0 otherwise.",
    parameters: {
        period: {
            unit: "seconds",
            range: [0, Infinity],
            description: "The interval which the clock should roll over at. If this is suddenly lowered, the clock may immediately roll over if the internal counter was less than the old period, but now greater than the new period."
        },
        speed: {
            unit: "seconds per second",
            description: "Makes the clock run faster or slower internally. If this is suddenly increased, the clock will NOT roll over as this doesn't affect the rollover point, only how fast that point is reached."
        }
    }
};
