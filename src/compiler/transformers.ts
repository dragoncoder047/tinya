import { str } from "../utils";
import { AST } from "./ast";
import { liftCommas } from "./core";
import { ErrorNote, ParseError } from "./errors";
import { countPlaceholdersIn, isPipe, replacePlaceholdersWith } from "./pipe";

const TRANSFORM_PASSES = [

    async function expandSymbols(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.UnaryOp) || ast.op !== ".") return ast.pipe(expandSymbols);
        if (!(ast.value instanceof AST.Name)) {
            throw new ParseError('unexpected "."', ast.loc);
        }
        return new AST.Symbol(ast.value.loc, ast.value.name);
    },

    async function expandInterpolations(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.UnaryOp) || ast.op !== "&") return ast.pipe(expandInterpolations);
        return new AST.InterpolatedValue(ast.loc, await ast.value.pipe(expandInterpolations));
    },

    async function expandMapping(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandMapping);
        if (!(ast instanceof AST.List)) return ast;
        const elements = ast.values;
        const firstKVIndex = elements.findIndex(e => (e instanceof AST.BinaryOp && e.op === "=>"));
        if (firstKVIndex < 0) {
            const firstColon = elements.find(e => (e instanceof AST.BinaryOp && e.op === ":"));
            if (firstColon) {
                throw new ParseError('mappings use "=>", not ":"', firstColon.loc);
            }
            return ast;
        }
        const kvPairs: { key: AST.Node, val: AST.Node }[] = [];
        for (var i = 0; i < elements.length; i++) {
            const el = elements[i]!;
            if (!(el instanceof AST.BinaryOp) || el.op !== "=>") {
                throw new ParseError(el instanceof AST.DefaultPlaceholder ? "illegal trailing comma in mapping" : 'expected "=>" after key value', el.edgemost(false).loc, i < firstKVIndex ? [new ErrorNote('hint: the "=>" first used here makes this a mapping, not a list', elements[firstKVIndex]!.loc)] : []);
            }
            kvPairs.push({ key: el.left, val: el.right });
        }
        return new AST.Mapping(ast.edgemost(true).loc, kvPairs);
    },

    async function commasToBlocks(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.BinaryOp) || (ast.op !== "," && ast.op !== ";")) return ast.pipe(commasToBlocks);
        return new AST.Block(ast.edgemost(true).loc, await Promise.all(liftCommas(ast, true).map(commasToBlocks)));
    },

    async function trimDefaultSentinelsInCallExpression(ast: any): Promise<AST.Node> {
        ast = await ast.pipe(trimDefaultSentinelsInCallExpression);
        if (ast instanceof AST.Call)
            while (ast.args.at(-1) instanceof AST.DefaultPlaceholder) ast.args.pop();
        return ast;
    },

    async function trimDefaultSentinelsInBlock(ast: any): Promise<AST.Node> {
        ast = await ast.pipe(trimDefaultSentinelsInBlock);
        if (ast instanceof AST.Block) {
            for (var i = 0; i < (ast.body.length - 1); i++) {
                if (ast.body[i] instanceof AST.DefaultPlaceholder) {
                    ast.body.splice(i, 1);
                    i--;
                }
            }
        }
        return ast;
    },

    async function expandDefinitions(ast: AST.Node, alreadyExpanded = false): Promise<AST.Node> {
        if (!(ast instanceof AST.BinaryOp) || ast.op !== ":-") return ast.pipe(expandDefinitions);
        const header = alreadyExpanded ? ast.left : await ast.left.pipe(expandDefinitions);
        const body = alreadyExpanded ? ast.right : await ast.right.pipe(expandDefinitions);
        if (!(header instanceof AST.Call)) {
            if (header instanceof AST.AnnotatedValue && header.value !== null) {
                ast.left = header.value;
                return new AST.AnnotatedValue(header.loc, header.attributes, await expandDefinitions(ast, true));
            }
            throw new ParseError("illegal header", header.edgemost(true).loc, [new ErrorNote("note: definition operator is here", ast.loc)]);
        }
        const params = header.args;
        var firstOptional: AST.Node | undefined;
        const realParams: AST.Node[] = [];
        for (var i = 0; i < params.length; i++) {
            const param = params[i]!;
            if (param instanceof AST.Name) {
                if (firstOptional) {
                    throw new ParseError("required parameter follows optional parameter", param.loc, [new ErrorNote("note: first optional parameter is here", firstOptional.loc)]);
                }
                realParams.push(param);
                continue;
            }
            if (!(param instanceof AST.BinaryOp) || (param.op !== ":" && param.op !== "=")) {
                throw new ParseError("illegal parameter", param.edgemost(true).loc);
            }
            var name = param.left, enums: AST.Node, default_: AST.Node | undefined;
            switch (param.op) {
                case ":":
                    default_ = undefined;
                    enums = param.right;
                    if (!(enums instanceof AST.Mapping)) {
                        throw new ParseError("expected a mapping", enums.loc);
                    }
                    if (!(name instanceof AST.Name)) {
                        throw new ParseError("illegal parameter name for options parameter", name.edgemost(false).loc);
                    }
                    for (var { key } of enums.mapping) {
                        if (!(key instanceof AST.Symbol)) {
                            throw new ParseError("expected a symbol here", key.edgemost(false).loc, [new ErrorNote(`note: while defining enum options for parameter ${str(name.name)}`, name.loc), ...(key instanceof AST.Name ? [new ErrorNote(`hint: put a "." before the ${str(key.name)} to make it a static symbol instead of a variable`, key.loc)] : [])]);
                        }
                    }
                    break;
                case "=":
                    enums = new AST.Mapping(param.loc, []);
                    if (name instanceof AST.BinaryOp && name.op === ":") {
                        enums = name.right;
                        name = name.left;
                    }
                    if (!(name instanceof AST.Name)) {
                        throw new ParseError("illegal parameter name for optional parameter", name.edgemost(false).loc);
                    }
                    default_ = param.right;
                    break;
                default:
                    throw "unreachable";
            }
            if (default_ === undefined) {
                default_ = new AST.DefaultPlaceholder(name.loc);
            } else {
                if (!firstOptional) firstOptional = name;
            }
            realParams.push(new AST.ParameterDescriptor(name.loc, name.name, enums, default_));
        }
        return new AST.Definition(header.loc, header.name, realParams, body);
    },

    async function expandAssignments(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.BinaryOp) || (ast.op !== "=" && !ast.assign)) return ast.pipe(expandAssignments);
        const target = await ast.left.pipe(expandAssignments);
        const body = await ast.right.pipe(expandAssignments);
        if (!(target instanceof AST.Name)) {
            throw new ParseError("illegal assignment target", target.edgemost(true).loc);
        }
        if (ast.assign) {
            return new AST.Assignment(target.loc, target.name, new AST.BinaryOp(ast.loc, ast.op, target, body, ast.noLift));
        }
        return new AST.Assignment(target.loc, target.name, body);
    },

    async function expandTernaryOperators(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.BinaryOp) || ast.op !== "?") return ast.pipe(expandTernaryOperators);
        const condition = await ast.left.pipe(expandTernaryOperators);
        const choices = await ast.right.pipe(expandTernaryOperators);
        if (!(choices instanceof AST.BinaryOp) || choices.op !== ":") {
            throw new ParseError('expected ":" after expression', (choices instanceof AST.BinaryOp ? choices : choices.edgemost(false)).loc, [new ErrorNote('note: "?" is here:', ast.loc)]);
        }
        return new AST.Conditional(ast.loc, condition, choices.left, choices.right);
    },

    async function createKeywordArguments(ast: AST.Node, parent: AST.Node | null = null): Promise<AST.Node> {
        if (!(ast instanceof AST.BinaryOp) || ast.op !== ":") return ast.pipe(e => createKeywordArguments(e, ast));
        const name = await ast.left.pipe(e => createKeywordArguments(e));
        const value = await ast.right.pipe(e => createKeywordArguments(e));
        if (!(name instanceof AST.Name)) {
            throw (parent instanceof AST.Call
                ? new ParseError('expected name before ":"', name.edgemost(false).loc)
                : new ParseError('unexpected ":"', ast.loc));
        }
        if (!(parent instanceof AST.Call)) {
            throw new ParseError("named parameter not directly inside a callsite", name.loc);
        }
        return new AST.KeywordArgument(name.loc, name.name, value);
    },

    async function validateKeywordArguments(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.Call)) return ast.pipe(validateKeywordArguments);
        const args = await Promise.all(ast.args.map(validateKeywordArguments));
        const firstKWArgIndex = args.findIndex(arg => arg instanceof AST.KeywordArgument);
        if (firstKWArgIndex < 0) return ast;
        const firstBadArgIndex = args.findIndex((arg, i) => !(arg instanceof AST.KeywordArgument) && i > firstKWArgIndex);
        if (firstBadArgIndex > 0) {
            throw new ParseError("non-keyword argument follows keyword argument", args[firstBadArgIndex]!.loc, [new ErrorNote("note: first keyword argument was here", args[firstKWArgIndex]!.loc)]);
        }
        return ast;
    },

    async function validateListDefaultSentinels(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.List)) return ast.pipe(validateListDefaultSentinels);
        const args = await Promise.all(ast.values.map(validateListDefaultSentinels));
        // Special case for empty list
        if (args.length === 1 && args[0] instanceof AST.DefaultPlaceholder) {
            return new AST.List(ast.loc, []);
        }
        for (var i = 0; i < args.length; i++) {
            const el = args[i]!;
            if (el instanceof AST.DefaultPlaceholder) {
                throw new ParseError((i + 1) === args.length ? "illegal trailing comma in list" : "empty elements not allowed in list", el.loc, [new ErrorNote("note: list starts here", ast.loc)]);
            }
        }
        return ast;
    },

    async function transformUnarySplatOperators(ast: AST.Node): Promise<AST.Node> {
        if (!(ast instanceof AST.UnaryOp) || ast.op !== "*") return ast.pipe(transformUnarySplatOperators);
        return new AST.SplatValue(ast.loc, await ast.value.pipe(transformUnarySplatOperators));
    },

    async function expandPipeOperators(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandPipeOperators);
        if (!isPipe(ast)) return ast;
        const sym = new AST.Gensym(ast.loc, [ast.loc.filename, ast.loc.line, ast.loc.col].join(":"));
        const arg = ast.left.simp();
        const expr = ast.right;
        const numPlaceholders = await countPlaceholdersIn(expr);
        if (numPlaceholders === 0) {
            throw new ParseError("missing '#' placeholder in pipe expression", expr.loc, [new ErrorNote("note: required by this pipe operator", ast.loc)]);
        } else if (numPlaceholders > 1 && !(arg instanceof AST.Value)) {
            return new AST.Block(ast.loc, [new AST.AssignToGensym(ast.loc, sym.id, arg), await replacePlaceholdersWith(expr, sym)]);
        } else {
            return replacePlaceholdersWith(expr, arg);
        }
    }

];

export async function transformAST(ast: AST.Node): Promise<AST.Node> {
    for (var transformer of TRANSFORM_PASSES) {
        ast = await transformer(ast);
    }
    return ast;
}
