import { str } from "../utils";
import { WorkletSynth } from "./synthImpl";

export function newSynth(context: AudioContext): ProxiedSynth {
    try {
        return makeSynthProxy(new AudioWorkletNode(context, "syd", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }));
    } catch (e: any) {
        if (e.name === "InvalidStateError") {
            throw new Error("failed to create Syd synthesizer node. Did you call initWorklet() and await the result?")
        }
        throw e;
    }
}

function makeSynthProxy(audioNode: AudioWorkletNode): ProxiedSynth {
    var idCounter = Number.MIN_SAFE_INTEGER;
    const resolvers = new Map<number, ReturnType<PromiseConstructor["withResolvers"]>>();
    audioNode.port.onmessage = event => {
        const data: MessageReply = event.data;
        console.log("[main thread] received message reply", data);
        const p = resolvers.get(data.id);
        if (p) {
            if (data.failed) p.reject(data.result);
            else p.resolve(data.result);
        }
        resolvers.delete(data.id);
    };
    return new Proxy<ProxyObject>({
        audioNode,
    }, {
        get(target: any, method: keyof ProxiedSynth) {
            if (method in target) return target[method];
            return (...args: Message["args"]) => {
                const id = idCounter++;
                const p = Promise.withResolvers();
                resolvers.set(id, p);
                audioNode.port.postMessage({ id, method, args } as Message);
                return p.promise;
            };
        },
        set(target, p) {
            throw new TypeError(`Cannot set property of ProxiedSynth ${str(p)} which is read-only`);
        }
    }) as ProxiedSynth;
}

type SynthMethod = {
    [K in keyof WorkletSynth]: WorkletSynth[K] extends Function ? K : never;
}[keyof WorkletSynth];

type PromiseFunction<T extends (...args: any) => any> = (...args: Parameters<T>) => Promise<ReturnType<T>>;

export type Message<T extends SynthMethod = SynthMethod> = {
    method: T;
    id: number;
    args: Parameters<WorkletSynth[T]>;
};
export type MessageReply<T extends SynthMethod = SynthMethod> = {
    id: number;
    result: ReturnType<WorkletSynth[T]>;
    failed: false;
} | {
    id: number;
    result: Error;
    failed: true;
};

type ProxyObject = {
    audioNode: AudioWorkletNode;
}
export type ProxiedSynth = ProxyObject & {
    [K in SynthMethod]: PromiseFunction<WorkletSynth[K]>
}
