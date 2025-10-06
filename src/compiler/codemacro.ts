import { isinstance } from "../utils";
import { AST } from "./ast";
import { processArgsInCall } from "./call";
import { EvalState, NodeDef, NodeValueType } from "./env";
import { RuntimeError } from "./errors";

export function makeCodeMacroExpander(name: string, params: AST.Node[], body: AST.Node): ((args: AST.Node[], state: EvalState) => Promise<AST.Node>) & { body: AST.Node } {
    const fakeNodeDef: NodeDef = [name, [], NodeValueType.NORMAL, [], null as any];
    var built = false;
    const f = async (args: AST.Node[], state: EvalState): Promise<AST.Node> => {
        if (!built) await build(state);
        const givenArgs = await processArgsInCall(state, false, args[0]!.loc, args, fakeNodeDef);
        const newState = { ...state, env: Object.create(state.globalEnv) };
        for (var i = 0; i < fakeNodeDef[1].length; i++) {
            newState.env[fakeNodeDef[1][i]![0]] = givenArgs[i]!;
        }
        return body.eval(newState);
    };
    f.body = body;
    return f;
    async function build(state: EvalState) {
        await validate(state);
        built = true;
        for (var i = 0; i < params.length; i++) {
            var param = params[i]!;
            if (isinstance(param, AST.Name)) {
                fakeNodeDef[1].push([param.name, null]);
                fakeNodeDef[3].push(undefined);
            } else if (isinstance(param, AST.ParameterDescriptor)) {
                var v: any = param.defaultValue;
                if (isinstance(v, AST.DefaultPlaceholder)) v = null;
                fakeNodeDef[1].push([param.name, v]);
                fakeNodeDef[3].push(await param.enumOptions.toJS(state) as any);
            } else throw new RuntimeError("unreachable", param.loc, AST.stackToNotes(state.callstack));
        }
    }
    async function validate(state: EvalState) {
        // TODO: check for possible infinite recursion and throw an error
    }
}
