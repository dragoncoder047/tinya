import { Message, MessageCode } from ".";
import { nodes } from "../lib";
import { Synth } from "../runtime/synth";

export class SydWorklet extends AudioWorkletProcessor {
    s: Synth | null = null;
    dt: number;
    constructor(sampleRate?: number) {
        super();
        this.dt = 1 / (sampleRate ?? globalThis.sampleRate);
        this.port.addEventListener("message", e => this.processMessage(e.data as Message));
    }
    processMessage(m: Message) {
        switch (m[0]) {
            case MessageCode.SETUP_SYNTH:
                this.s = new Synth(this.dt, nodes(), m[1], m[2]);
                return;
        }
        const s = this.s!;
        switch (m[0]) {
            case MessageCode.ADD_WAVETABLE:
                s.addWave(m[1], m[2]);
                break;
            case MessageCode.NOTE_ON:
                s.noteOn(m[1], m[2], m[3], m[4]);
                break;
            case MessageCode.NOTE_OFF:
                s.noteOff(m[1]);
                break;
            case MessageCode.AUTOMATE:
                s.automate(m[1], m[2], m[3], m[4]);
                break;
            case MessageCode.PITCH_BEND:
                if (m[1]) s.pitchBend(m[2], m[3], m[4]);
                else s.postFX.pitch.goto(m[2], m[3], m[4]);
                break;
            case MessageCode.EXPRESSION:
                if (m[1]) s.expressionBend(m[2], m[3], m[4]);
                else s.postFX.expression.goto(m[2], m[3], m[4]);
                break;
            default:
                m[0] satisfies never;
        }
    }
    process(input: Float32Array[][], out: Float32Array[][]) {
        if (out.length > 0)
            this.s!.process(out[0]![0]!, out[0]![1]!);
        return true;
    }
}
