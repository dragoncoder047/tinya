import { CompiledVoiceData, Opcode } from "../compiler/prog";
import { str } from "../utils";

export function disassemble(data: CompiledVoiceData): string {
    const outLines: string[] = [];
    const prog = data.p;
    var pc = 0;
    const next = () => prog[pc++] as any;
    const nNode = () => {
        const number = next() as number;
        return `${number} (${data.nn[number]})`;
    }

    while (pc < prog.length) {
        const code = next() as Opcode;
        const opName = Opcode[code];
        var arg: string[] = [];
        switch (code) {
            case Opcode.PUSH_CONSTANT:
                arg = [str(next())];
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
            case Opcode.DO_UNARY_OP:
            case Opcode.GET_REGISTER:
            case Opcode.TAP_REGISTER:
                arg = [str(next())];
                break;
            case Opcode.CONDITIONAL_SELECT:
            case Opcode.STEREO_DOUBLE_WIDEN:
                break;
            case Opcode.APPLY_NODE:
                arg = [nNode(), str(next()) + " args"];
                break;
            case Opcode.GET_MOD:
                arg = [str(next())];
                break;
            case Opcode.APPLY_DOUBLE_NODE_STEREO:
                arg = [nNode(), nNode(), str(next()) + " args"];
                break;
            default:
                code satisfies never;
        }
        outLines.push(`${opName} ${arg.join(", ")}`)
    }
    return outLines.join("\n");
}
