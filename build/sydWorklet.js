import {
  nodes,
  passthroughFx
} from "./chunk-YO3MNY3H.js";
import {
  OPERATORS,
  __name,
  isArray,
  isNumber
} from "./chunk-HMJMCDWR.js";

// src/runtime/automation.ts
var AutomatedValue = class {
  constructor(initial, mode) {
    this.mode = mode;
    this.value = initial;
  }
  static {
    __name(this, "AutomatedValue");
  }
  delta = 0;
  value = 0;
  target = 0;
  timeLeft = 0;
  goto(newValue, dt, time) {
    switch (this.mode) {
      case 0 /* LINEAR */:
        this.delta = dt * (newValue - this.value) / time;
        break;
      case 1 /* EXPONENTIAL */:
        if (this.value * newValue <= 0) {
          throw new Error("cannot cross 0 when in exponential mode");
        }
        this.delta = Math.pow(newValue / this.value, dt / time);
    }
    this.target = newValue;
    this.timeLeft = time;
  }
  /** HOT CODE */
  update(dt) {
    this.timeLeft -= dt;
    if (this.timeLeft < 0) {
      this.timeLeft = 0;
      return this.value = this.target;
    }
    switch (this.mode) {
      case 0 /* LINEAR */:
        return this.value += this.delta;
      case 1 /* EXPONENTIAL */:
        return this.value *= this.delta;
    }
  }
};

// src/runtime/tone.ts
var Tone = class {
  constructor(state, dt, synth, pitch, expression) {
    this.dt = dt;
    this.synth = synth;
    this.p = state.p;
    this.r = state.r.map((_) => 0);
    this.n = state.nn.map((nn) => synth.nodes.find((nd) => nd[0] === nn)[4](synth));
    this.pitch = new AutomatedValue(pitch, 1 /* EXPONENTIAL */);
    this.expression = new AutomatedValue(expression, 1 /* EXPONENTIAL */);
    this.mods = state.mods.map(([_, initial, mode]) => new AutomatedValue(initial, mode));
    this.modToIndexMap = Object.fromEntries(state.mods.map((m, i) => [m[0], i]));
  }
  static {
    __name(this, "Tone");
  }
  p;
  r;
  n;
  sc = [];
  ac = [];
  acL = [];
  acR = [];
  tmp = [0, 0];
  pitch;
  expression;
  mods;
  modToIndexMap;
  alive = true;
  /** SCREAMING HOT CODE */
  processSample(sampleNo, l, r, mode, gate, gain) {
    const stack = this.sc;
    const args = this.ac;
    const argsL = this.acL;
    const argsR = this.acR;
    const prog = this.p;
    const registers = this.r;
    const nodes2 = this.n;
    const tmp = this.tmp;
    const pitch = this.pitch.value;
    const expression = this.expression.value;
    const push = /* @__PURE__ */ __name((x) => stack.push(x), "push");
    const pop = /* @__PURE__ */ __name(() => stack.pop(), "pop");
    const peek = /* @__PURE__ */ __name(() => stack.at(-1), "peek");
    const next = /* @__PURE__ */ __name(() => prog[pc++], "next");
    var pc, sp, a, b, c, i;
    stack.length = args.length = argsL.length = argsR.length = pc = sp = 0;
    while (pc < prog.length) {
      const code = next();
      switch (code) {
        case 0 /* PUSH_CONSTANT */:
          push(next());
          break;
        case 1 /* PUSH_INPUT_SAMPLES */:
          tmp.length = 2;
          tmp[0] = l[sampleNo];
          tmp[1] = r[sampleNo];
          push(tmp);
          break;
        case 2 /* PUSH_PITCH */:
          push(pitch);
          break;
        case 3 /* PUSH_EXPRESSION */:
          push(expression);
          break;
        case 4 /* PUSH_GATE */:
          push(gate);
          break;
        case 5 /* MARK_STILL_ALIVE */:
          this.alive = true;
          break;
        case 6 /* DROP_TOP */:
          pop();
          break;
        case 7 /* PUSH_FRESH_EMPTY_LIST */:
          push([]);
          break;
        case 8 /* APPEND_TO_LIST */:
          a = pop();
          peek().push(a);
          break;
        case 9 /* EXTEND_TO_LIST */:
          a = pop();
          peek().push(...a);
          break;
        case 10 /* DO_BINARY_OP */:
          b = pop();
          a = pop();
          push(OPERATORS[next()].cb(a, b));
          break;
        case 11 /* DO_UNARY_OP */:
          a = pop();
          push(OPERATORS[next()].cu(a));
          break;
        case 12 /* GET_REGISTER */:
          push(registers[next()]);
          break;
        case 13 /* TAP_REGISTER */:
          registers[next()] = peek();
          break;
        case 14 /* CONDITIONAL_SELECT */:
          c = pop();
          b = pop();
          a = pop();
          push(c ? b : a);
          break;
        case 15 /* STEREO_DOUBLE_WIDEN */:
          a = pop();
          push([a, a]);
          break;
        case 16 /* APPLY_NODE */:
          a = next();
          i = args.length = next();
          while (i > 0) {
            i--;
            args[i] = pop();
          }
          push(nodes2[a](this.dt, args));
          break;
        case 18 /* GET_MOD */:
          push(this.mods[next()]?.value ?? 0);
          break;
        case 17 /* APPLY_DOUBLE_NODE_STEREO */:
          a = next();
          b = next();
          i = args.length = argsL.length = argsR.length = c = next();
          while (i > 0) {
            i--;
            args[i] = pop();
          }
          while (i < c) {
            if (isArray(args[i])) {
              argsL[i] = args[i][0];
              argsR[i] = args[i][1];
            } else {
              argsL[i] = argsR[i] = args[i];
            }
            i++;
          }
          push([nodes2[a](this.dt, argsL), nodes2[b](this.dt, argsR)]);
          break;
        default:
          code;
      }
    }
    a = pop();
    if (!isArray(a)) {
      tmp.length = 2;
      tmp[0] = tmp[1] = a;
      a = tmp;
    }
    if (isNumber(a[0]) && isNaN(a[0])) a[0] = 0;
    if (isNumber(a[0]) && isNaN(a[1])) a[1] = 0;
    switch (mode) {
      case 0 /* SET */:
        l[sampleNo] = a[0] * gain;
        r[sampleNo] = a[1] * gain;
        break;
      case 1 /* ADD */:
        l[sampleNo] += a[0] * gain;
        r[sampleNo] += a[1] * gain;
        break;
    }
  }
  /** HOT CODE */
  processBlock(leftBuffer, rightBuffer, mode, gate, gain) {
    const len = leftBuffer.length;
    var sampleNo, modNo;
    for (sampleNo = 0; sampleNo < len; sampleNo++) {
      for (modNo = 0; modNo < this.mods.length; modNo++) {
        this.mods[modNo].update(this.dt);
      }
      this.processSample(sampleNo, leftBuffer, rightBuffer, mode, gate, gain);
    }
  }
  automate(name, value, atTime) {
    this.mods[this.modToIndexMap[name]]?.goto(value, this.dt, atTime);
  }
};

// src/runtime/instrument.ts
var Instrument = class {
  constructor(dt, synth, voiceTemplate, fxDef) {
    this.dt = dt;
    this.synth = synth;
    this.voiceTemplate = voiceTemplate;
    this.fx = new Tone(fxDef, dt, synth, 1, 1);
  }
  static {
    __name(this, "Instrument");
  }
  liveNotes = {};
  liveNoteCount = 0;
  deadNotes = {};
  fx;
  inputs = {};
  prevInputs = null;
  lb = new Float32Array();
  rb = new Float32Array();
  noteOn(id, pitch, expression) {
    if (this.liveNotes[id]) this.noteOff(id);
    this.liveNotes[id] = new Tone(this.voiceTemplate, this.dt, this.synth, pitch, expression);
    this.liveNoteCount++;
  }
  noteOff(id) {
    const note = this.liveNotes[id];
    if (!note) return;
    this.deadNotes[id] = [note, gainForChord(this.liveNoteCount)];
    delete this.liveNotes[id];
    this.liveNoteCount--;
  }
  pitchBend(id, pitch, time) {
    this.liveNotes[id]?.pitch.goto(pitch, this.dt, time);
  }
  expressionBend(id, expression, time) {
    this.liveNotes[id]?.expression.goto(expression, this.dt, time);
  }
  automate(param, value, time, note) {
    if (note !== void 0) this.liveNotes[note].automate(param, value, time);
    else {
      for (var k of Object.keys(this.liveNotes)) this.liveNotes[+k].automate(param, value, time);
      this.fx.automate(value, this.dt, time);
    }
  }
  /** HOT CODE */
  process(left, right) {
    var lb = this.lb, rb = this.rb, len = left.length;
    if (lb.buffer.byteLength < left.buffer.byteLength) {
      this.lb = lb = new Float32Array(len);
      this.rb = rb = new Float32Array(len);
    } else if (lb.length !== len) {
      this.lb = lb = new Float32Array(lb.buffer, 0, len);
      this.rb = rb = new Float32Array(rb.buffer, 0, len);
    }
    var i;
    const liveNoteCount = this.liveNoteCount, liveNotes = this.liveNotes, deadNotes = this.deadNotes;
    for (i in liveNotes) {
      liveNotes[i].processBlock(lb, rb, 1 /* ADD */, true, gainForChord(liveNoteCount));
    }
    for (i in deadNotes) {
      var tone = deadNotes[i][0];
      var gain = deadNotes[i][1];
      tone.alive = false;
      tone.processBlock(lb, rb, 1 /* ADD */, false, gain);
      if (!tone.alive) {
        delete deadNotes[i];
      }
    }
    this.fx.processBlock(lb, rb, 0 /* SET */, true, 1);
    for (i = 0; i < len; i++) {
      left[i] += lb[i];
      right[i] += rb[i];
    }
  }
};
function gainForChord(chordSize) {
  return 1 / ((chordSize - 1) / 4 + 1);
}
__name(gainForChord, "gainForChord");

// src/runtime/synthImpl.ts
var WorkletSynth = class {
  constructor(dt) {
    this.dt = dt;
    this.clearAll();
  }
  static {
    __name(this, "WorkletSynth");
  }
  instruments = [];
  postFX = null;
  n2i = {};
  waves = {};
  nodes = nodes();
  volume = 0.8;
  clearAll() {
    this.instruments = [];
    this.postFX = new Tone(passthroughFx(), this.dt, this, 0, 1);
  }
  addWave(name, wave) {
    this.waves[name] = wave;
  }
  addInstrument(voiceDef, fxDef) {
    return this.instruments.push(new Instrument(this.dt, this, voiceDef, fxDef)) - 1;
  }
  setPostFX(fxDef) {
    this.postFX = new Tone(fxDef, this.dt, this, 1, 1);
  }
  setVolume(volume) {
    this.volume = volume;
  }
  getInstrumentCount() {
    return this.instruments.length;
  }
  _ifn(noteID) {
    return this.instruments[this.n2i[noteID]];
  }
  noteOn(id, instrument, pitch, expression) {
    this._ifn(id)?.noteOff(id);
    this.instruments[this.n2i[id] = instrument]?.noteOn(id, pitch, expression);
  }
  noteOff(id) {
    this._ifn(id)?.noteOff(id);
    delete this.n2i[id];
  }
  automate(instrument, param, value, time) {
    (this.instruments[instrument] ?? this.postFX).automate(param, value, time);
  }
  pitchBend(id, pitch, time) {
    this._ifn(id)?.pitchBend(id, pitch, time);
  }
  expressionBend(id, expression, time) {
    this._ifn(id)?.expressionBend(id, expression, time);
  }
  /** HOT CODE */
  process(left, right) {
    const instruments = this.instruments;
    for (var i = 0; i < instruments.length; i++) {
      instruments[i].process(left, right);
    }
    this.postFX?.processBlock(left, right, 0 /* SET */, true, this.volume);
  }
};

// src/worklet/index.ts
var SydWorklet = class extends AudioWorkletProcessor {
  static {
    __name(this, "SydWorklet");
  }
  synth = new WorkletSynth(1 / sampleRate);
  constructor() {
    super();
    this.port.onmessage = (e) => this.handleMessage(e.data);
    console.log("[audio worklet thread] setup message handler");
  }
  async handleMessage(m) {
    try {
      console.log("[audio worklet thread] received message", m);
      const result = await this.synth[m.method](...m.args);
      this.port.postMessage({ id: m.id, result, failed: false });
    } catch (e) {
      this.port.postMessage({ id: m.id, result: e, failed: true });
    }
  }
  process(input, out) {
    if (out.length > 0)
      this.synth?.process(out[0][0], out[0][1]);
    return true;
  }
};

// src/sydWorklet.ts
registerProcessor("syd", SydWorklet);
//# sourceMappingURL=sydWorklet.js.map
