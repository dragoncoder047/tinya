import { CompiledVoiceData, Opcode } from "../compiler/prog";
import { str } from "../utils";

export function disassemble(data: CompiledVoiceData): string {
    const prog = data.p;
    const nNode = (number: number) => {
        return `${number} (${data.nn[number]})`;
    }
    const stack: [string, ...any][] = [];
    for (var command of prog) {
        const opName = Opcode[command[0]];
        var arg: string[] = [];
        var dependents: number = 0;
        switch (command[0]) {
            // @ts-ignore
            case Opcode.PUSH_CONSTANT:
                arg = [str(command[1])];
            case Opcode.PUSH_INPUT_SAMPLES:
            case Opcode.PUSH_PITCH:
            case Opcode.PUSH_EXPRESSION:
            case Opcode.PUSH_GATE:
            case Opcode.MARK_STILL_ALIVE:
                dependents = 0;
                break;
            case Opcode.DROP_TOP:
                dependents = 1;
                break;
            case Opcode.PUSH_FRESH_EMPTY_LIST:
                dependents = 0;
                break;
            case Opcode.APPEND_TO_LIST:
            case Opcode.EXTEND_TO_LIST:
                dependents = 2;
                break;
            case Opcode.DO_BINARY_OP:
            case Opcode.DO_BINARY_OP_STEREO:
                arg = [str(command[1])];
                dependents = 2;
                break;
            case Opcode.DO_UNARY_OP:
            case Opcode.DO_UNARY_OP_STEREO:
                arg = [str(command[1])];
                dependents = 1;
                break;
            case Opcode.GET_REGISTER:
                arg = [str(command[1])];
                dependents = 0;
                break;
            case Opcode.TAP_REGISTER:
            case Opcode.SHIFT_REGISTER:
                arg = [str(command[1])];
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
                arg = [nNode(command[1] as number), str(command[2]) + " args"];
                break;
            case Opcode.GET_MOD:
                arg = [str(command[1])];
                dependents = 0;
                break;
            case Opcode.APPLY_DOUBLE_NODE_STEREO:
                dependents = command[2] as number;
                arg = [nNode(command[1] as number), nNode(command[2] as number), str(command[1]) + " args"];
                break;
            default:
                command[0] satisfies never;
        }
        const deps = stack.splice(stack.length - dependents, dependents);
        stack.push([`${opName} ${arg.join(", ")}`, ...deps]);
    }
    var out = "";
    const recurse = (a: any[], depth: number) => {
        for (var i = 1; i < a.length; i++) {
            recurse(a[i], depth + 1);
        }
        out += "|  ".repeat(depth) + a[0] + "\n";
    }
    recurse(stack.pop()!, 0);
    return out;
}
