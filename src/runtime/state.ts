import { NodeDef } from "../compiler/evalState";
import { OPERATORS } from "../compiler/operator";
import { CompileState, Opcode, Program } from "../compiler/prog";
import { isArray, isNumber, map } from "../utils";

export class LiveSynthState {
    p: Program;
    r: any[];
    n: ReturnType<NodeDef[4]>[];
    sc: any[] = [];
    ac: any[] = [];
    res: [number, number] = null as any;
    constructor(state: CompileState) {
        this.p = state.p;
        this.r = state.r.map(_ => 0);
        this.n = state.nn.map(nn => state.ni.find(nd => nd[0] === nn)![4]!());
    }
    singleSample(dt: number, inputs: Record<string, any>) {
        const stack = this.sc;
        const args = this.sc;
        const prog = this.p;
        const registers = this.r;
        const nodes = this.n;
        stack.length = 0;
        args.length = 0;
        const argsL = [] as any[], argsR = [] as any[];
        const push = (x: any) => stack[sp++] = x;
        const pop = () => stack[sp--];
        const peek = () => stack[sp];
        const next = () => prog[pc++] as number;
        var pc = 0, sp = 0, a, b, c, i;
        while (pc < prog.length) {
            const code = next() as Opcode;
            switch (code) {
                case Opcode.PUSH_CONSTANT:
                    push(next());
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
                    i = 0;
                    while (i < c) args[i++] = pop();
                    push(nodes[a]!(dt, args));
                    break;
                case Opcode.GET_INPUT:
                    push(inputs[next()] ?? 0);
                    break;
                case Opcode.APPLY_DOUBLE_NODE_STEREO:
                    a = pop();
                    b = pop();
                    c = pop();
                    argsL.length = argsR.length = i = 0;
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
                    push([nodes[a]!(dt, argsL), nodes[b]!(dt, argsR)]);
                    break;
                default:
                    code satisfies never;
                    throw new Error("unknown opcode ")
            }
        }
        a = pop();
        if (isArray(a)) {
            if (isNaN(a[0])) a[0] = 0;
            if (isNaN(a[1])) a[1] = 0;
        } else a = isNaN(a) ? [0, 0] : [a, a];
        this.res = a as [number, number];
    }
    blockSamples(dtPerSample: number, inputsStart: Record<string, any>, inputsEnd: Record<string, any>, out: [Float32Array, Float32Array]) {
        const [leftBuffer, rightBuffer] = out;
        const len = leftBuffer.length;
        const inputsCur = Object.assign({}, inputsEnd);
        const inputNames = Object.keys(inputsEnd);
        for (var sampleNo = 0; sampleNo < len; sampleNo++) {
            for (var i = 0; i < inputNames.length; i++) {
                const a = inputsStart[inputNames[i]!];
                const b = inputsEnd[inputNames[i]!];
                if (isNumber(a) && isNumber(b))
                    inputsCur[inputNames[i]!] = map(sampleNo, 0, len, a, b);
            }
            this.singleSample(dtPerSample, inputsCur);
            leftBuffer[sampleNo] = this.res[0];
            rightBuffer[sampleNo] = this.res[1];
        }
    }
}
