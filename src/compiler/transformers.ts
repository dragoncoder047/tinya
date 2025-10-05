import { isinstance, str } from "../utils";
import { AST } from "./ast";
import { liftCommas } from "./core";
import { ErrorNote, ParseError } from "./errors";
import { countPlaceholdersIn, isPipe, replacePlaceholdersWith } from "./pipe";

const TRANSFORM_PASSES = [

    async function expandSymbols(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.UnaryOp) || ast.op !== ".") return ast.pipe(expandSymbols);
        if (!isinstance(ast.value, AST.Name)) {
            throw new ParseError('unexpected "."', ast.loc);
        }
        return new AST.Symbol(ast.value.loc, ast.value.name);
    },

    async function expandInterpolations(ast: AST.Node): Promise<AST.Node> {
        if (!(isinstance(ast, AST.UnaryOp)) || ast.op !== "&") return ast.pipe(expandInterpolations);
        return new AST.InterpolatedValue(ast.loc, await ast.value.pipe(expandInterpolations));
    },

    async function expandMapping(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandMapping);
        if (!isinstance(ast, AST.List)) return ast;
        const elements = ast.values;
        const firstKVIndex = elements.findIndex(e => (isinstance(e, AST.BinaryOp) && e.op === "=>"));
        if (firstKVIndex < 0) {
            const firstColon = elements.find(e => (isinstance(e, AST.BinaryOp) && e.op === ":"));
            if (firstColon) {
                throw new ParseError('mappings use "=>", not ":"', firstColon.loc);
            }
            return ast;
        }
        const kvPairs: { key: AST.Node, val: AST.Node }[] = [];
        for (var i = 0; i < elements.length; i++) {
            const el = elements[i]!;
            if (!isinstance(el, AST.BinaryOp) || el.op !== "=>") {
                throw new ParseError(isinstance(el, AST.DefaultPlaceholder) ? "illegal trailing comma in mapping" : 'expected "=>" after key value', el.edgemost(false).loc, i < firstKVIndex ? [new ErrorNote('hint: the "=>" first used here makes this a mapping, not a list', elements[firstKVIndex]!.loc)] : []);
            }
            kvPairs.push({ key: el.left, val: el.right });
        }
        return new AST.Mapping(ast.edgemost(true).loc, kvPairs);
    },

    async function commasToBlocks(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || (ast.op !== "," && ast.op !== ";")) return ast.pipe(commasToBlocks);
        return new AST.Block(ast.edgemost(true).loc, await Promise.all(liftCommas(ast, true).map(commasToBlocks)));
    },

    async function trimDefaultSentinelsInCallExpression(ast: any): Promise<AST.Node> {
        ast = await ast.pipe(trimDefaultSentinelsInCallExpression);
        if (isinstance(ast, AST.Call))
            while (isinstance(ast.args.at(-1), AST.DefaultPlaceholder)) ast.args.pop();
        return ast;
    },

    async function trimDefaultSentinelsInBlock(ast: any): Promise<AST.Node> {
        ast = await ast.pipe(trimDefaultSentinelsInBlock);
        if (isinstance(ast, AST.Block)) {
            for (var i = 0; i < (ast.body.length - 1); i++) {
                if (isinstance(ast.body[i], AST.DefaultPlaceholder)) {
                    ast.body.splice(i, 1);
                    i--;
                }
            }
        }
        return ast;
    },

    async function expandDefinitions(ast: AST.Node, alreadyExpanded = false): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || ast.op !== ":-") return ast.pipe(expandDefinitions);
        const header = alreadyExpanded ? ast.left : await ast.left.pipe(expandDefinitions);
        const body = alreadyExpanded ? ast.right : await ast.right.pipe(expandDefinitions);
        if (!isinstance(header, AST.Call)) {
            if (isinstance(header, AST.AnnotatedValue) && header.value !== null) {
                ast.left = header.value;
                return new AST.AnnotatedValue(header.loc, header.attributes, await expandDefinitions(ast, true));
            }
            throw new ParseError("illegal header", header.edgemost(true).loc, [new ErrorNote("note: definition operator is here", ast.loc)]);
        }
        return new AST.Definition(header.loc, header.name, header.args, body);
    },

    async function expandAssignments(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || (ast.op !== "=" && !ast.assign)) return ast.pipe(expandAssignments);
        const target = await ast.left.pipe(expandAssignments);
        const body = await ast.right.pipe(expandAssignments);
        if (!isinstance(target, AST.Name)) {
            throw new ParseError("illegal assignment target", target.edgemost(true).loc);
        }
        if (ast.assign) {
            return new AST.Assignment(target.loc, target.name, new AST.BinaryOp(ast.loc, ast.op, target, body, ast.noLift));
        }
        return new AST.Assignment(target.loc, target.name, body);
    },

    async function expandTernaryOperators(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || ast.op !== "?") return ast.pipe(expandTernaryOperators);
        const condition = await ast.left.pipe(expandTernaryOperators);
        const choices = await ast.right.pipe(expandTernaryOperators);
        if (!isinstance(choices, AST.BinaryOp) || choices.op !== ":") {
            throw new ParseError('expected ":" after expression', (isinstance(choices, AST.BinaryOp) ? choices : choices.edgemost(false)).loc, [new ErrorNote('note: "?" is here:', ast.loc)]);
        }
        return new AST.Conditional(ast.loc, condition, choices.left, choices.right);
    },

    async function createKeywordArguments(ast: AST.Node, parent: AST.Node | null = null): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || ast.op !== ":") return ast.pipe(e => createKeywordArguments(e, ast));
        const name = await ast.left.pipe(e => createKeywordArguments(e));
        const value = await ast.right.pipe(e => createKeywordArguments(e));
        if (!isinstance(name, AST.Name)) {
            throw (isinstance(parent, AST.Call)
                ? new ParseError('expected name before ":"', name.edgemost(false).loc)
                : new ParseError('unexpected ":"', ast.loc));
        }
        if (!isinstance(parent, AST.Call)) {
            throw new ParseError("named parameter not directly inside a callsite", name.loc);
        }
        return new AST.KeywordArgument(name.loc, name.name, value);
    },

    async function fixAndValidateListDefaultSentinels(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.List)) return ast.pipe(fixAndValidateListDefaultSentinels);
        const args = await Promise.all(ast.values.map(fixAndValidateListDefaultSentinels));
        // Special case for empty list
        if (args.length === 1 && isinstance(args[0], AST.DefaultPlaceholder)) {
            return new AST.List(ast.loc, []);
        }
        for (var i = 0; i < args.length; i++) {
            const el = args[i]!;
            if (isinstance(el, AST.DefaultPlaceholder)) {
                throw new ParseError((i + 1) === args.length ? "illegal trailing comma in list" : "empty elements not allowed in list", el.loc, [new ErrorNote("note: list starts here", ast.loc)]);
            }
        }
        return new AST.List(ast.loc, args);
    },

    async function transformUnarySplatOperators(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.UnaryOp) || ast.op !== "*") return ast.pipe(transformUnarySplatOperators);
        return new AST.SplatValue(ast.loc, await ast.value.pipe(transformUnarySplatOperators));
    },

    async function expandPipeOperators(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandPipeOperators);
        if (!isPipe(ast)) return ast;
        const sym = new AST.Name(ast.loc, ["_pipe", ast.loc.file.replace(/[^a-z]/ig, ""), ast.loc.line, ast.loc.col].join("_"));
        const arg = ast.left.simp();
        const expr = ast.right;
        const numPlaceholders = await countPlaceholdersIn(expr);
        if (numPlaceholders === 0) {
            throw new ParseError("missing '#' placeholder in pipe expression", expr.loc, [new ErrorNote("note: required by this pipe operator", ast.loc)]);
        } else if (numPlaceholders > 1 && !isinstance(arg, AST.Value)) {
            return new AST.Block(ast.loc, [new AST.Assignment(ast.loc, sym.name, arg), await replacePlaceholdersWith(expr, sym)]);
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
