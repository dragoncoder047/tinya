import { CompiledVoiceData, Opcode } from "../compiler/prog";
import { str } from "../utils";

export function disassemble(data: CompiledVoiceData): string {
    const outLines: string[] = [];
    const prog = data.p;
    const nNode = (number: number) => {
        return `${number} (${data.nn[number]})`;
    }

    for (var command of prog) {
        const opName = Opcode[command[0]];
        var arg: string[] = [];
        switch (command[0]) {
            case Opcode.PUSH_CONSTANT:
                arg = [str(command[1])];
                break;
            case Opcode.PUSH_INPUT_SAMPLES:
            case Opcode.PUSH_PITCH:
            case Opcode.PUSH_EXPRESSION:
            case Opcode.PUSH_GATE:
            case Opcode.MARK_STILL_ALIVE:
            case Opcode.DROP_TOP:
            case Opcode.PUSH_FRESH_EMPTY_LIST:
            case Opcode.APPEND_TO_LIST:
            case Opcode.EXTEND_TO_LIST:
                break;
            case Opcode.DO_BINARY_OP:
            case Opcode.DO_BINARY_OP_STEREO:
            case Opcode.DO_UNARY_OP:
            case Opcode.DO_UNARY_OP_STEREO:
            case Opcode.GET_REGISTER:
            case Opcode.TAP_REGISTER:
                arg = [str(command[1])];
                break;
            case Opcode.CONDITIONAL_SELECT:
            case Opcode.STEREO_DOUBLE_WIDEN:
                break;
            case Opcode.APPLY_NODE:
                arg = [nNode(command[1] as number), str(command[2]) + " args"];
                break;
            case Opcode.GET_MOD:
                arg = [str(command[1])];
                break;
            case Opcode.APPLY_DOUBLE_NODE_STEREO:
                arg = [nNode(command[1] as number), nNode(command[2] as number), str(command[1]) + " args"];
                break;
            default:
                command[0] satisfies never;
        }
        outLines.push(`${opName} ${arg.join(", ")}`)
    }
    return outLines.join("\n");
}
