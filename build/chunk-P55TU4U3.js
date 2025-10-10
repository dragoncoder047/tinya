import {
  TAU,
  __name,
  abs,
  cos,
  noise3,
  noise5,
  saw,
  sgn,
  sin,
  tan,
  tri
} from "./chunk-PAJYDYBO.js";

// src/lib/nodes/effects.ts
var zzfxFilter = [
  "zzfxFilter",
  [["sample", null], ["cutoff", null], ["quality", 2]],
  0 /* NORMAL_OR_MONO */,
  [],
  () => {
    var x2 = 0, x1 = 0, y2 = 0, y1 = 0;
    return (dt, args) => {
      const sample = args[0], cutoff = args[1], quality = args[2];
      var w = TAU * abs(cutoff) * 2 * dt, cos_ = cos(w), alpha = sin(w) / 2 / quality, a0 = 1 + alpha, a1 = -2 * cos_ / a0, a2 = (1 - alpha) / a0, b0 = (1 + sgn(cutoff) * cos_) / 2 / a0, b1 = -(sgn(cutoff) + cos_) / a0, b2 = b0;
      return y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = sample) - a2 * y2 - a1 * (y2 = y1);
    };
  }
];
var zzfxFilterHelp = {
  description: "Combination biquad low-pass / high-pass filter as implemented in ZzFX.",
  parameters: {
    cutoff: {
      range: [-1e4, 1e4],
      unit: "Hz",
      description: "The cutoff frequency of the filter. The sign decides between low-pass (>=0) and high-pass (<0) and the magnitude is the cutoff frequency."
    },
    quality: {
      range: [0, 2],
      description: "Affects the resonance of the filter."
    }
  }
};
var bitcrusher = [
  "bitcrusher",
  [["sample", null], ["sampleRate", 8e3]],
  0 /* NORMAL_OR_MONO */,
  [],
  () => {
    var phase = 0, last = 0;
    return (dt, args) => {
      const sample = args[0], bitcrushSampleRate = args[1];
      phase += bitcrushSampleRate * dt;
      if (phase >= 1) {
        phase -= phase | 0;
        last = sample;
      }
      return last;
    };
  }
];
var bitcrusherHelp = {
  description: "The classic low-fidelity effect produced by resampling the audio at a lower sample rate.",
  parameters: {
    sampleRate: {
      range: [1, 48e3],
      unit: "Hz"
    }
  }
};
var delay = [
  "delay",
  [["sample", null], ["time", 0]],
  0 /* NORMAL_OR_MONO */,
  [],
  () => {
    var len = 1 << 14;
    var buffer = new Float32Array(len);
    var pos = 0;
    return (dt, args) => {
      const sample = args[0], delayTime = args[1];
      const delaySamples = delayTime / dt;
      if (delaySamples > len) {
        var newLen = len << 1;
        const newBuffer = new Float32Array(len);
        for (var i = 0; i < len; i++) newBuffer[i] = buffer[pos + i & len - 1];
        buffer = newBuffer;
        pos = len;
        len = newLen;
      }
      const out = buffer[pos + len - delaySamples & len - 1];
      buffer[pos] = sample;
      pos = pos + 1 & len - 1;
      return out;
    };
  }
];
var delayHelp = {
  description: "Singular delay line. No self-feedback or interpolation between samples.",
  parameters: {
    time: {
      range: [0, 100],
      unit: "seconds",
      description: "How long to delay the sample for. Changing this mid-delay will effectively pitch-shift the buffered samples"
    }
  }
};

// src/lib/nodes/generators.ts
var zzfxOscillator = [
  "zzfxOscillator",
  [["freq", null], ["shape", 0], ["distortion", 1], ["noise", 0], ["phi", 0]],
  0 /* NORMAL_OR_MONO */,
  [, { sine: 0, triangle: 1, sawtooth: 2, tangent: 3, noise3: 4 }],
  () => {
    var phase = 0, sampleNo = 0;
    return (dt, args) => {
      const frequency = args[0], shape = args[1], distortion = args[2], noise = args[3], phaseMod = args[4];
      const sample = (shape > 3 ? noise3 : shape > 2 ? tan : shape > 1 ? saw : shape ? tri : sin)(phaseMod * TAU + (phase += frequency * TAU * dt * (1 + noise * noise5(sampleNo++))));
      return sgn(sample) * abs(sample) ** distortion;
    };
  }
];
var zzfxOscillatorHelp = {
  description: "Multi-waveform oscillator like that of ZzFX.",
  parameters: {
    freq: {
      unit: "Hz",
      range: [0, 2e4]
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
      description: "How much extra noise to add to the wave."
    },
    phi: {
      range: [0, 1],
      unit: "cycles (NOT radians!)",
      description: "Modulates the oscillator's phase without adding to the internal accumulator. Useful for FM synthesis."
    }
  }
};

// src/lib/nodes/logic.ts
var shimmered = [
  "shimmered",
  [["value", 0], ["amount", 0.05]],
  0 /* NORMAL_OR_MONO */,
  [],
  () => {
    var oldValue = 0, out = 0;
    return (dt, args) => {
      const value = args[0], amount = args[1];
      if (oldValue !== value) {
        out = value + (Math.random() - 0.5) * amount * value;
        oldValue = value;
      }
      return out;
    };
  }
];
var shimmeredHelp = {
  description: "Each time the input value changes, perturbs it by a small amount. No noise is added.",
  parameters: {
    amount: {
      unit: "fraction of value",
      range: [0, 1]
    }
  }
};
var integrator = [
  "integrate",
  [["derivative", 0], ["resetClock", 0], ["resetValue", 0], ["boundaryMode", 1], ["low", -Infinity], ["high", Infinity], ["sampleMode", 1]],
  0 /* NORMAL_OR_MONO */,
  [, , , { clamp: 1, wrap: 0 }, , , { integrate: 1, accumulate: 0 }],
  () => {
    var integral = 0, prevReset = 0;
    return (dt, args) => {
      const integrand = args[0], reset = args[1], resetTo = args[2], boundaryMode = args[3], low = Math.min(args[4], args[5]), high = Math.max(args[4], args[5]), sampleMode = args[6];
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
    };
  }
];
var integratorHelp = {
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
var clock = [
  "clock",
  [["period", 1], ["speed", 1]],
  0 /* NORMAL_OR_MONO */,
  [],
  () => {
    var time = Infinity;
    return (dt, args) => {
      const period = args[0], speedScale = args[1];
      time += speedScale * dt;
      if (time >= period) {
        time = 0;
        return 1;
      }
      return 0;
    };
  }
];
var clockHelp = {
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

// src/lib/index.ts
function nodes() {
  return [
    zzfxOscillator,
    zzfxFilter,
    bitcrusher,
    delay,
    shimmered,
    integrator,
    clock
  ];
}
__name(nodes, "nodes");
function baseEnv() {
  return {
    globalEnv: {},
    env: {},
    functions: [],
    nodes: nodes(),
    callstack: [],
    recursionLimit: 1e3,
    // TODO
    annotators: {}
  };
}
__name(baseEnv, "baseEnv");
function baseCompileState() {
  return {
    p: [],
    r: [],
    nn: [],
    tosStereo: false,
    mods: []
  };
}
__name(baseCompileState, "baseCompileState");
function nodeHelp() {
  return {
    zzfxOscillator: zzfxOscillatorHelp,
    zzfxFilter: zzfxFilterHelp,
    bitcrusher: bitcrusherHelp,
    delay: delayHelp,
    shimmered: shimmeredHelp,
    integrator: integratorHelp,
    clock: clockHelp
  };
}
__name(nodeHelp, "nodeHelp");

// src/worklet/index.ts
var MessageCode = /* @__PURE__ */ ((MessageCode2) => {
  MessageCode2[MessageCode2["SETUP_SYNTH"] = 0] = "SETUP_SYNTH";
  MessageCode2[MessageCode2["ADD_WAVETABLE"] = 1] = "ADD_WAVETABLE";
  MessageCode2[MessageCode2["NOTE_ON"] = 2] = "NOTE_ON";
  MessageCode2[MessageCode2["NOTE_OFF"] = 3] = "NOTE_OFF";
  MessageCode2[MessageCode2["PITCH_BEND"] = 4] = "PITCH_BEND";
  MessageCode2[MessageCode2["EXPRESSION"] = 5] = "EXPRESSION";
  MessageCode2[MessageCode2["AUTOMATE"] = 6] = "AUTOMATE";
  return MessageCode2;
})(MessageCode || {});

export {
  nodes,
  baseEnv,
  baseCompileState,
  nodeHelp,
  MessageCode
};
//# sourceMappingURL=chunk-P55TU4U3.js.map
