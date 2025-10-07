import { isinstance, str } from "../utils";
import { AST } from "./ast";
import { EvalState, NodeDef } from "./env";
import { RuntimeError, ErrorNote, LocationTrace } from "./errors";

export async function processArgsInCall(state: EvalState, doEvalArgs: boolean, site: LocationTrace, args: AST.Node[], nodeImpl: NodeDef) {
    const newArgs: AST.Node[] = [];
    const seenArgs: Record<string, AST.Node> = {};
    var firstKW: AST.Node | undefined;
    for (var i = 0; i < args.length; i++) {
        const arg = args[i]!;
        var argIndex = i;
        if (isinstance(arg, AST.KeywordArgument)) {
            if (seenArgs[arg.name]) {
                throw new RuntimeError(`argument ${str(arg.name)} already provided`, arg.loc, [new ErrorNote("note: first occurrance was here:", seenArgs[arg.name]!.edgemost(true).loc), ...AST.stackToNotes(state.callstack)]);
            }
            if (!firstKW) firstKW = arg;
            argIndex = nodeImpl[1].findIndex(a => a[0] === arg.name);
            if (argIndex === -1) {
                throw new RuntimeError(`no such keyword argument ${str(arg.name)} on node ${nodeImpl[0]}`, arg.loc, AST.stackToNotes(state.callstack));
            }
        } else {
            if (firstKW) throw new RuntimeError("positional argument can't come after keyword argument", arg.loc, [new ErrorNote("note: first keyword argument was here:", firstKW.loc), ...AST.stackToNotes(state.callstack)]);
            if (i >= nodeImpl[1].length) throw new RuntimeError("too many arguments to " + nodeImpl[0], arg.edgemost(true).loc, AST.stackToNotes(state.callstack));
        }
        const argEntry = nodeImpl[1][argIndex]!;
        seenArgs[argEntry[0]] = arg;
        const defaultValue = argEntry[1];
        const enumChoices = nodeImpl[3][argIndex] ?? null;
        const walkAndReplaceSymbols = async (ast: AST.Node): Promise<AST.Node> => {
                if (isinstance(ast, AST.Call)) return ast; // Don't walk into another call's symbols
                if (isinstance(ast, AST.Symbol)) {
                    var value: any = enumChoices?.[ast.value];
                    if ((value ?? undefined) === undefined) {
                        throw new RuntimeError(enumChoices ? `unknown symbol name ${str(ast.value)} for parameter` : "symbol constant not valid here", ast.loc, enumChoices ? [new ErrorNote("note: valid options are: " + Object.keys(enumChoices).join(", "), ast.loc)] : []);
                    }
                    if (!isinstance(value, AST.Value)) {
                        value = new AST.Value(ast.loc, value);
                    }
                    return value;
                }
                return ast.pipe(walkAndReplaceSymbols);
            };
        var value = await walkAndReplaceSymbols(arg);
        if (isinstance(arg, AST.DefaultPlaceholder)) {
            if ((defaultValue ?? null) === null) {
                throw new RuntimeError(`missing value for argument ${argEntry[0]}`, arg.loc, AST.stackToNotes(state.callstack));
            }
            value = new AST.Value(arg.loc, defaultValue);
        } else if (isinstance(arg, AST.SplatValue)) {
            throw new RuntimeError("splats are only valid in a list", arg.loc, AST.stackToNotes(state.callstack));
        } else if (doEvalArgs) {
            value = await value.eval(state);
        }
        newArgs[argIndex] = value;
    }
    for (var i = 0; i < nodeImpl[1].length; i++) {
        if (newArgs[i] === undefined) {
            const argEntry = nodeImpl[1][i]!;
            const defaultValue = argEntry[1];
            if ((defaultValue ?? null) === null) {
                throw new RuntimeError(`missing value for argument ${argEntry[0]}`, site, AST.stackToNotes(state.callstack));
            }
            newArgs[i] = new AST.Value(site, defaultValue);
        }
    }
    return newArgs;
}
