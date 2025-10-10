import { NodeDef } from "../compiler/evalState";
import { CompileState } from "../compiler/prog";
import { Instrument } from "./instrument";
import { Tone } from "./tone";

export class Synth {
    instruments: Instrument[] = [];
    postFX: Tone;
    n2i: Record<number, number> = {};
    waves: Record<string, Float32Array> = {};
    constructor(
        public dt: number,
        public nodes: NodeDef[],
        instruments: [CompileState, CompileState][],
        postFX: CompileState,
    ) {
        for (var [tt, fxt] of instruments) {
            this.instruments.push(new Instrument(dt, this, tt, fxt));
        }
        this.postFX = new Tone(postFX, dt, this, 1, 0.3);
    }
    addWave(name: string, wave: Float32Array) {
        this.waves[name] = wave;
    }
    private _ifn(noteID: number) {
        return this.instruments[this.n2i[noteID]!];
    }
    noteOn(id: number, instrument: number, pitch: number, expression: number) {
        this._ifn(id)?.noteOff(id);
        this.instruments[this.n2i[id] = instrument]?.noteOn(id, pitch, expression);
    }
    noteOff(id: number) {
        this._ifn(id)?.noteOff(id);
        delete this.n2i[id];
    }
    automate(instrument: number | undefined, param: string, value: any, time: number) {
        (this.instruments[instrument as any] ?? this.postFX).automate(param, value, time);
    }
    pitchBend(id: number, pitch: number, time: number) {
        this._ifn(id)?.pitchBend(id, pitch, time);
    }
    expressionBend(id: number, expression: number, time: number) {
        this._ifn(id)?.expressionBend(id, expression, time);
    }
    /** HOT CODE */
    process(left: Float32Array, right: Float32Array) {
        const instruments = this.instruments;
        for (var i = 0; i < instruments.length; i++) {
            instruments[i]!.process(left, right);
        }
    }
}
