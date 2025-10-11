import { WorkletSynth } from "../runtime/synthImpl";
import { Message, MessageReply } from "../runtime/synthProxy";

export class SydWorklet extends AudioWorkletProcessor {
    synth: WorkletSynth = new WorkletSynth(1 / sampleRate);
    constructor() {
        super();
        this.port.onmessage = e => this.handleMessage(e.data as Message);
        console.log("[audio worklet thread] setup message handler");
    }
    async handleMessage(m: Message) {
        try {
            console.log("[audio worklet thread] received message", m);
            const result = await (this.synth as any)[m.method](...m.args);
            this.port.postMessage({ id: m.id, result, failed: false } as MessageReply);
        } catch (e) {
            this.port.postMessage({ id: m.id, result: e as Error, failed: true } as MessageReply);
        }
    }
    process(input: Float32Array[][], out: Float32Array[][]) {
        if (out.length > 0)
            (this.synth as any)?.process(out[0]![0]!, out[0]![1]!);
        return true;
    }
}
