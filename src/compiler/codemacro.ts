import { isinstance, str } from "../utils";
import { AST } from "./ast";
import { processArgsInCall } from "./call";
import { EvalState, NodeDef, NodeValueType } from "./env";
import { ErrorNote, RuntimeError } from "./errors";

export function makeCodeMacroExpander(name: string, params: AST.Node[], body: AST.Node): ((args: AST.Node[], state: EvalState) => Promise<AST.Node>) & { body: AST.Node } {
    const fakeNodeDef: NodeDef = ["", [], NodeValueType.NORMAL, [], null as any];
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
        var firstOptional: AST.Node | undefined;
        const realParams: [string, number | null, Record<string, number> | undefined][] = [];
        for (var i = 0; i < params.length; i++) {
            const param = params[i]!;
            if (isinstance(param, AST.Name)) {
                if (firstOptional) {
                    throw new RuntimeError("required parameter follows optional parameter", param.loc, [new ErrorNote("note: first optional parameter is here", firstOptional.loc)]);
                }
                realParams.push([param.name, null, undefined]);
                continue;
            }
            if (!isinstance(param, AST.BinaryOp) || (param.op !== ":" && param.op !== "=")) {
                throw new RuntimeError("illegal parameter", param.edgemost(true).loc);
            }
            var name = param.left as any, enums: any, default_: any = null;
            switch (param.op) {
                case ":":
                    enums = param.right as any;
                    if (!isinstance(enums, AST.Mapping)) {
                        throw new RuntimeError("expected a mapping", enums.loc);
                    }
                    if (!isinstance(name, AST.Name)) {
                        throw new RuntimeError("illegal parameter name for options parameter", name.edgemost(false).loc);
                    }
                    for (var { key } of enums.mapping) {
                        if (!isinstance(key, AST.Symbol)) {
                            throw new RuntimeError("expected a symbol here", key.edgemost(false).loc, [new ErrorNote(`note: while defining enum options for parameter ${str(name.name)}`, name.loc), ...(isinstance(key, AST.Name) ? [new ErrorNote(`hint: put a "." before the ${str(key.name)} to make it a static symbol instead of a variable`, key.loc)] : [])]);
                        }
                    }
                    break;
                case "=":
                    enums = new AST.Mapping(param.loc, []);
                    if (isinstance(name, AST.BinaryOp) && name.op === ":") {
                        enums = name.right;
                        name = name.left as any;
                    }
                    if (!isinstance(name, AST.Name)) {
                        throw new RuntimeError("illegal parameter name for optional parameter", name.edgemost(false).loc);
                    }
                    default_ = await param.right.eval(state) as any;
                    break;
                default:
                    throw "unreachable";
            }
            if (!firstOptional) firstOptional = name;
            realParams.push([name.name, default_.value, enums.toJS()]);
        }
        // We now have real parameters, put them in the right parts of the fake node-def
        for (var [n, d, e] of realParams) {
            fakeNodeDef[1].push([n, d]);
            fakeNodeDef[3].push(e);
        }
    }
    async function validate(state: EvalState) {
        // TODO: check for possible infinite recursion and throw an error
    }
}
