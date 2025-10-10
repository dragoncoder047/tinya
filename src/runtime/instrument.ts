import { CompileState } from "../compiler/prog";
import { Synth } from "./synth";
import { PassMode, Tone } from "./tone";

export class Instrument {
    liveNotes: Record<number, Tone> = {};
    liveNoteCount = 0;
    deadNotes: Record<number, [Tone, number]> = {};
    fx: Tone;
    inputs: Record<string, any> = {};
    prevInputs: Record<string, any> = null as any;
    lb = new Float32Array();
    rb = new Float32Array();
    constructor(
        public dt: number,
        public synth: Synth,
        public voiceTemplate: CompileState,
        fxDef: CompileState
    ) {
        this.fx = new Tone(fxDef, dt, synth, 1, 1);
    }
    noteOn(id: number, pitch: number, expression: number) {
        if (this.liveNotes[id]) this.noteOff(id);
        this.liveNotes[id] = new Tone(this.voiceTemplate, this.dt, this.synth, pitch, expression);
        this.liveNoteCount++;
    }
    noteOff(id: number) {
        const note = this.liveNotes[id];
        if (!note) return;
        this.deadNotes[id] = [note, gainForChord(this.liveNoteCount)];
        delete this.liveNotes[id];
        this.liveNoteCount--;
    }
    pitchBend(id: number, pitch: number, time: number) {
        this.liveNotes[id]?.pitch.goto(pitch, this.dt, time);
    }
    expressionBend(id: number, expression: number, time: number) {
        this.liveNotes[id]?.expression.goto(expression, this.dt, time);
    }
    automate(param: string, value: any, time: number, note?: number) {
        if (note !== undefined) this.liveNotes[note]!.automate(param, value, time);
        else {
            for (var k of Object.keys(this.liveNotes)) this.liveNotes[+k]!.automate(param, value, time);
            this.fx.automate(value, this.dt, time);
        }
    }
    /** HOT CODE */
    process(left: Float32Array, right: Float32Array) {
        var lb = this.lb, rb = this.rb, len = left.length;
        if (lb.buffer.byteLength < left.buffer.byteLength) {
            this.lb = lb = new Float32Array(len);
            this.rb = rb = new Float32Array(len);
        } else if (lb.length !== len) {
            this.lb = lb = new Float32Array(lb.buffer, 0, len);
            this.rb = rb = new Float32Array(rb.buffer, 0, len);
        }
        var i: any;
        const liveNoteCount = this.liveNoteCount, liveNotes = this.liveNotes, deadNotes = this.deadNotes
        for (i in liveNotes) {
            liveNotes[i]!.processBlock(lb, rb, PassMode.ADD, true, gainForChord(liveNoteCount));
        }
        for (i in deadNotes) {
            var tone = deadNotes[i]![0];
            var gain = deadNotes[i]![1];
            tone.alive = false;
            tone.processBlock(lb, rb, PassMode.ADD, false, gain);
            if (!tone.alive) {
                delete deadNotes[i];
            }
        }
        this.fx.processBlock(lb, rb, PassMode.SET, true, 1);
        for (i = 0; i < len; i++) {
            left[i]! += lb[i]!;
            right[i]! += rb[i]!;
        }
    }
}

function gainForChord(chordSize: number) {
    return 1 / ((chordSize - 1) / 4 + 1);
}
