import { NodeDef } from "../compiler/evalState";
import { CompiledVoiceData } from "../compiler/prog";
import { nodes, passthroughFx } from "../lib";
import { Instrument } from "./instrument";
import { PassMode, Tone } from "./tone";


export class WorkletSynth {
    instruments: Instrument[] = [];
    postFX: Tone = null as any;
    n2i: Record<number, number> = {};
    waves: Record<string, Float32Array> = {};
    nodes: NodeDef[] = nodes();
    volume: number = 0.8;
    constructor(public dt: number) {
        this.clearAll();
    }
    clearAll() {
        this.instruments = [];
        this.postFX = new Tone(passthroughFx(), this.dt, this, 0, 1);
    }
    addWave(name: string, wave: Float32Array) {
        this.waves[name] = wave;
    }
    addInstrument(voiceDef: CompiledVoiceData, fxDef: CompiledVoiceData): number {
        return this.instruments.push(new Instrument(this.dt, this, voiceDef, fxDef)) - 1;
    }
    setPostFX(fxDef: CompiledVoiceData): void {
        this.postFX = new Tone(fxDef, this.dt, this, 1, 1);
    }
    setVolume(volume: number) {
        this.volume = volume;
    }
    getInstrumentCount() {
        return this.instruments.length;
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
    private process(left: Float32Array, right: Float32Array) {
        const instruments = this.instruments;
        for (var i = 0; i < instruments.length; i++) {
            instruments[i]!.process(left, right);
        }
        this.postFX?.processBlock(left, right, PassMode.SET, true, this.volume);
    }
}
