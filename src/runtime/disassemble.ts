import { CompiledVoiceData, Opcode } from "../compiler/prog";
import { isArray } from "../utils";

export function disassemble(data: CompiledVoiceData): string {
    const prog = data.p;
    const nNode = (number: number) => {
        return `${number} (${data.nn[number]})`;
    }
    const stack: [string, ...any][] = [];
    var noopCount = 0;
    const s = (x: any): string => isArray(x) ? `[${x.map(s)}]` : "" + x;
    mainloop: for (var command of prog) {
        const opName = Opcode[command[0]];
        var arg: string[] = [];
        var dependents: number = 0;
        switch (command[0]) {
            // @ts-ignore
            case Opcode.NOOP:
                noopCount++;
                stack.push([opName]);
                continue mainloop;
            // @ts-ignore
            case Opcode.PUSH_CONSTANT:
                arg = [s(command[1])];
            case Opcode.PUSH_INPUT_SAMPLES:
            case Opcode.PUSH_PITCH:
            case Opcode.PUSH_EXPRESSION:
            case Opcode.PUSH_GATE:
            case Opcode.MARK_STILL_ALIVE:
            case Opcode.PUSH_FRESH_EMPTY_LIST:
                dependents = 0;
                break;
            case Opcode.APPEND_TO_LIST:
            case Opcode.EXTEND_TO_LIST:
                dependents = 2;
                break;
            case Opcode.PUSH_FRESH_EMPTY_MAP:
                dependents = 0;
                break;
            case Opcode.ADD_TO_MAP:
                dependents = 3;
                break;
            case Opcode.DO_BINARY_OP:
            case Opcode.DO_BINARY_OP_STEREO:
                arg = [s(command[1])];
                dependents = 2;
                break;
            case Opcode.DO_UNARY_OP:
            case Opcode.DO_UNARY_OP_STEREO:
                arg = [s(command[1])];
                dependents = 1;
                break;
            case Opcode.GET_REGISTER:
                arg = [s(command[1])];
                dependents = 0;
                break;
            case Opcode.TAP_REGISTER:
            case Opcode.SHIFT_REGISTER:
                arg = [s(command[1])];
                dependents = 1;
                break;
            case Opcode.CONDITIONAL_SELECT:
                dependents = 3;
                break;
            case Opcode.STEREO_DOUBLE_WIDEN:
                dependents = 1;
                break;
            case Opcode.APPLY_NODE:
                dependents = command[2] as number;
                arg = [nNode(command[1] as number), s(command[2]) + " args"];
                break;
            case Opcode.GET_MOD:
                arg = [s(command[1])];
                dependents = 0;
                break;
            case Opcode.APPLY_DOUBLE_NODE_STEREO:
                dependents = command[2] as number;
                arg = [nNode(command[1] as number), nNode(command[2] as number), s(command[1]) + " args"];
                break;
            default:
                command[0] satisfies never;
        }
        const deps = stack.splice(stack.length - dependents - noopCount, dependents + noopCount);
        stack.push([`${opName} ${arg.join(", ")}`, ...deps]);
        noopCount = 0;
    }
    var out = "";
    const recurse = (a: any[], depth: number) => {
        for (var i = 1; i < a.length; i++) {
            recurse(a[i], depth + 1);
        }
        out += "|  ".repeat(depth) + a[0] + "\n";
    }
    while (stack.length > 0) recurse(stack.shift()!, 0);
    return out;
}
