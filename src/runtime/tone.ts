import { NodeDef } from "../compiler/evalState";
import { OPERATORS } from "../compiler/operator";
import { CompileState, Opcode, Program } from "../compiler/prog";
import { isArray, isNumber } from "../utils";
import { AutomatedValue, AutomatedValueMethod } from "./automation";
import { Synth } from "./synth";

export enum PassMode {
    SET,
    ADD,
}

export class Tone {
    p: Program;
    r: any[];
    n: ReturnType<NodeDef[4]>[];
    sc: any[] = [];
    ac: any[] = [];
    acL: any[] = [];
    acR: any[] = [];
    tmp: [number, number] = null as any;
    pitch: AutomatedValue;
    expression: AutomatedValue;
    mods: AutomatedValue[];
    modToIndexMap: Record<string, number>;
    alive = true;
    constructor(
        state: CompileState,
        public dt: number,
        public synth: Synth,
        pitch: number,
        expression: number) {
        this.p = state.p;
        this.r = state.r.map(_ => 0);
        this.n = state.nn.map(nn => synth.nodes.find(nd => nd[0] === nn)![4]!(synth));
        this.pitch = new AutomatedValue(pitch, AutomatedValueMethod.EXPONENTIAL);
        this.expression = new AutomatedValue(expression, AutomatedValueMethod.EXPONENTIAL);
        this.mods = state.mods.map(([_, initial, mode]) => new AutomatedValue(initial, mode));
        this.modToIndexMap = Object.fromEntries(state.mods.map((m, i) => [m[0], i]));
        if (state.tosStereo) {
            this.p.push(Opcode.STEREO_DOUBLE_WIDEN);
        }
    }
    /** SCREAMING HOT CODE */
    processSample(
        sampleNo: number,
        l: Float32Array,
        r: Float32Array,
        mode: PassMode,
        gate: boolean,
        gain: number) {
        const stack = this.sc;
        const args = this.sc;
        const argsL = this.acL
        const argsR = this.acR;
        const prog = this.p;
        const registers = this.r;
        const nodes = this.n;
        const tmp = this.tmp;
        const pitch = this.pitch.value;
        const expression = this.expression.value;

        const push = (x: any) => stack[sp++] = x;
        const pop = () => stack[sp--];
        const peek = () => stack[sp];
        const next = () => prog[pc++] as number;

        var pc: number, sp: number, a, b, c, i;
        stack.length = args.length = argsL.length = argsR.length = pc = sp = 0;

        while (pc < prog.length) {
            const code = next() as Opcode;
            switch (code) {
                case Opcode.PUSH_CONSTANT:
                    push(next());
                    break;
                case Opcode.PUSH_INPUT_SAMPLES:
                    tmp.length = 2;
                    tmp[0] = l[sampleNo]!;
                    tmp[1] = r[sampleNo]!;
                    push(tmp);
                    break;
                case Opcode.PUSH_PITCH:
                    push(pitch);
                    break;
                case Opcode.PUSH_EXPRESSION:
                    push(expression);
                    break;
                case Opcode.PUSH_GATE:
                    push(gate);
                    break;
                case Opcode.MARK_STILL_ALIVE:
                    this.alive = true;
                    break;
                case Opcode.DROP_TOP:
                    pop();
                    break;
                case Opcode.PUSH_FRESH_EMPTY_LIST:
                    push([]);
                    break;
                case Opcode.APPEND_TO_LIST:
                    a = pop();
                    peek().push(a);
                    break;
                case Opcode.EXTEND_TO_LIST:
                    a = pop();
                    peek().push(...a);
                    break;
                case Opcode.DO_BINARY_OP:
                    b = pop();
                    a = pop();
                    push(OPERATORS[next()]!.cb!(a, b));
                    break;
                case Opcode.DO_UNARY_OP:
                    a = pop();
                    push(OPERATORS[next()]!.cu!(a));
                    break;
                case Opcode.GET_REGISTER:
                    push(registers[next()]);
                    break;
                case Opcode.TAP_REGISTER:
                    registers[next()] = peek();
                    break;
                case Opcode.CONDITIONAL_SELECT:
                    c = pop();
                    b = pop();
                    a = pop();
                    push(c ? b : a);
                    break;
                case Opcode.STEREO_DOUBLE_WIDEN:
                    a = pop();
                    push([a, a]);
                    break;
                case Opcode.APPLY_NODE:
                    a = pop();
                    c = pop();
                    args.length = c;
                    i = 0;
                    while (i < c) args[i++] = pop();
                    push(nodes[a]!(this.dt, args));
                    break;
                case Opcode.GET_MOD:
                    push(this.mods[next()]?.value ?? 0);
                    break;
                case Opcode.APPLY_DOUBLE_NODE_STEREO:
                    a = pop();
                    b = pop();
                    c = pop();
                    argsL.length = argsR.length = c;
                    i = 0;
                    while (i < c) args[i++] = pop();
                    i = 0;
                    while (i < c) {
                        if (isArray(args[i])) {
                            argsL[i] = args[i][0];
                            argsR[i] = args[i][1];
                        } else {
                            argsL[i] = argsR[i] = args[i];
                        }
                        i++;
                    }
                    push([nodes[a]!(this.dt, argsL), nodes[b]!(this.dt, argsR)]);
                    break;
                default:
                    code satisfies never;
            }
        }
        a = pop();
        if (isNumber(a[0]) && isNaN(a[0])) a[0] = 0;
        if (isNumber(a[0]) && isNaN(a[1])) a[1] = 0;
        switch (mode) {
            case PassMode.SET:
                l[sampleNo] = a[0] * gain;
                r[sampleNo] = a[1] * gain;
                break;
            case PassMode.ADD:
                l[sampleNo]! += a[0] * gain;
                r[sampleNo]! += a[1] * gain;
                break;
        }
    }
    /** HOT CODE */
    processBlock(
        leftBuffer: Float32Array,
        rightBuffer: Float32Array,
        mode: PassMode,
        gate: boolean,
        gain: number) {
        const len = leftBuffer.length;
        var sampleNo, modNo;
        for (sampleNo = 0; sampleNo < len; sampleNo++) {
            for (modNo = 0; modNo < this.mods.length; modNo++) {
                this.mods[modNo]!.update(this.dt);
            }
            this.processSample(sampleNo, leftBuffer, rightBuffer, mode, gate, gain);
        }
    }
    automate(name: string, value: number, atTime: number) {
        this.mods[this.modToIndexMap[name]!]?.goto(value, this.dt, atTime);
    }
}
