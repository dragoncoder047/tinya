import { str } from "../utils";
import { AST, ASTBinaryOp, ASTConditional, ASTBlock, ASTCall, ASTNameReference, ASTKeywordArg, ASTDefine, ASTSymbol, ASTParameterDescriptor, ASTDefaultPlaceholder, ASTTemplate, ASTAssignment, ASTUnaryOp, ASTInterpolation, ASTMapping, ASTList } from "./ast";
import { liftCommas } from "./core";
import { ErrorNote, ParseError } from "./errors";

const TRANSFORM_PASSES = [

    function expandSymbols(ast: AST): AST {
        if (!(ast instanceof ASTUnaryOp) || ast.op !== ".") return ast.map(expandSymbols);
        if (!(ast.value instanceof ASTNameReference)) {
            throw new ParseError('unexpected "."', ast.location);
        }
        return new ASTSymbol(ast.value.location, ast.value.name);
    },

    function expandInterpolations(ast: AST): AST {
        if (!(ast instanceof ASTUnaryOp) || ast.op !== "&") return ast.map(expandInterpolations);
        return new ASTInterpolation(ast.location, ast.value.map(expandInterpolations));
    },

    function expandMapping(ast: AST): AST {
        if (!(ast instanceof ASTList)) return ast.map(expandMapping);
        const exp = ast.map(expandMapping);
        const elements = exp.values;
        const firstKVIndex = elements.findIndex(e => (e instanceof ASTBinaryOp && e.op === "=>"));
        if (firstKVIndex < 0) {
            const firstColon = elements.find(e => (e instanceof ASTBinaryOp && e.op === ":"));
            if (firstColon) {
                throw new ParseError('mappings use "=>", not ":"', firstColon.location);
            }
            return exp;
        }
        const kvPairs: { key: AST, val: AST }[] = [];
        for (var i = 0; i < elements.length; i++) {
            const el = elements[i]!;
            if (!(el instanceof ASTBinaryOp) || el.op !== "=>") {
                throw new ParseError(el instanceof ASTDefaultPlaceholder ? "illegal trailing comma in mapping" : 'expected "=>" after key value', el.edgemost(false).location, i < firstKVIndex ? [new ErrorNote('hint: the "=>" first used here makes this a mapping, not a list', elements[firstKVIndex]!.location)] : []);
            }
            kvPairs.push({ key: el.left, val: el.right });
        }
        return new ASTMapping(exp.edgemost(true).location, kvPairs);
    },

    function commasToBlocks(ast: AST): AST {
        if (!(ast instanceof ASTBinaryOp) || ast.op !== ",") return ast.map(commasToBlocks);
        return new ASTBlock(ast.edgemost(true).location, liftCommas(ast, true).map(commasToBlocks));
    },

    function processDefaultSentinels(ast: any): AST {
        return ast;
    },

    function expandDefinitions(ast: AST): AST {
        if (!(ast instanceof ASTBinaryOp) || ast.op !== ":-") return ast.map(expandDefinitions);
        const header = ast.left.map(expandDefinitions);
        const body = ast.right.map(expandDefinitions);
        if (!(header instanceof ASTCall)) {
            throw new ParseError("illegal header", header.edgemost(true).location, [new ErrorNote("note: definition operator is here", ast.location)]);
        }
        const params = header.args;
        var firstOptional: AST | undefined;
        const realParams: AST[] = [];
        for (var i = 0; i < params.length; i++) {
            const param = params[i]!;
            if (param instanceof ASTNameReference) {
                if (firstOptional) {
                    throw new ParseError("required parameter follows optional parameter", param.location, [new ErrorNote("note: first optional parameter is here", firstOptional.location)]);
                }
                realParams.push(param);
                continue;
            }
            if (!(param instanceof ASTBinaryOp) || (param.op !== ":" && param.op !== "=")) {
                throw new ParseError("illegal parameter", param.edgemost(true).location);
            }
            var name = param.left, enums: AST, default_: AST | undefined;
            switch (param.op) {
                case ":":
                    default_ = undefined;
                    enums = param.right;
                    if (!(enums instanceof ASTMapping)) {
                        throw new ParseError("expected a mapping", enums.location);
                    }
                    if (!(name instanceof ASTNameReference)) {
                        throw new ParseError("illegal parameter name for options parameter", name.edgemost(false).location);
                    }
                    for (var { key } of enums.mapping) {
                        if (!(key instanceof ASTSymbol)) {
                            throw new ParseError("expected a symbol here", key.edgemost(false).location, [new ErrorNote(`note: while defining enum options for parameter ${str(name.name)}`, name.location), ...(key instanceof ASTNameReference ? [new ErrorNote(`hint: put a "." before the ${str(key.name)} to make it a static symbol instead of a variable`, key.location)] : [])]);
                        }
                    }
                    break;
                case "=":
                    enums = new ASTMapping(param.location, []);
                    if (name instanceof ASTBinaryOp && name.op === ":") {
                        enums = name.right;
                        name = name.left;
                    }
                    if (!(name instanceof ASTNameReference)) {
                        throw new ParseError("illegal parameter name for optional parameter", name.edgemost(false).location);
                    }
                    default_ = param.right;
                    break;
                default:
                    throw "unreachable";
            }
            if (default_ === undefined) {
                default_ = new ASTDefaultPlaceholder(name.location);
            } else {
                if (!firstOptional) firstOptional = name;
            }
            realParams.push(new ASTParameterDescriptor(name.location, name.name, enums, default_));
        }
        return new ASTDefine(header.location, header.name, realParams, body);
    },

    function expandAssignments(ast: AST): AST {
        if (!(ast instanceof ASTBinaryOp) || (ast.op !== "=" && !ast.assign)) return ast.map(expandAssignments);
        const target = ast.left.map(expandAssignments);
        const body = ast.right.map(expandAssignments);
        if (!(target instanceof ASTNameReference)) {
            throw new ParseError("illegal assignment target", target.edgemost(true).location);
        }
        if (ast.assign) {
            return new ASTAssignment(target.location, target.name, new ASTBinaryOp(ast.location, ast.op, target, body, ast.noLift));
        }
        return new ASTAssignment(target.location, target.name, body);
    },

    function expandTernaryOperators(ast: AST): AST {
        if (!(ast instanceof ASTBinaryOp) || ast.op !== "?") return ast.map(expandTernaryOperators);
        const condition = ast.left.map(expandTernaryOperators);
        const choices = ast.right.map(expandTernaryOperators);
        if (!(choices instanceof ASTBinaryOp) || choices.op !== ":") {
            throw new ParseError('expected ":" after expression', (choices instanceof ASTBinaryOp ? choices : choices.edgemost(false)).location, [new ErrorNote('note: "?" is here:', ast.location)]);
        }
        return new ASTConditional(ast.location, condition, choices.left, choices.right);
    },

    function createKeywordArguments(ast: AST, insideCall = false): AST {
        if (ast instanceof ASTCall) return ast.map(e => createKeywordArguments(e, true));
        if (!(ast instanceof ASTBinaryOp) || ast.op !== ":") return ast.map(e => createKeywordArguments(e, false));
        const name = ast.left.map(e => createKeywordArguments(e, false));
        const value = ast.right.map(e => createKeywordArguments(e, false));
        if (!(name instanceof ASTNameReference)) {
            throw (insideCall
                ? new ParseError('expected name before ":"', name.edgemost(false).location)
                : new ParseError('unexpected ":"', ast.location));
        }
        if (!insideCall) {
            throw new ParseError("named parameter not directly inside a callsite", name.location);
        }
        return new ASTKeywordArg(name.location, name.name, value);
    },

    function validateKeywordArguments(ast: AST): AST {
        if (!(ast instanceof ASTCall)) return ast.map(validateKeywordArguments);
        const args = ast.args.map(validateKeywordArguments);
        const firstKWArgIndex = args.findIndex(arg => arg instanceof ASTKeywordArg);
        if (firstKWArgIndex < 0) return ast;
        const firstBadArgIndex = args.findIndex((arg, i) => !(arg instanceof ASTKeywordArg) && i > firstKWArgIndex);
        if (firstBadArgIndex > 0) {
            throw new ParseError("non-keyword argument follows keyword argument", args[firstBadArgIndex]!.location, [new ErrorNote("note: first keyword argument was here", args[firstKWArgIndex]!.location)]);
        }
        return ast;
    },

    function validateListDefaultSentinels(ast: AST): AST {
        if (!(ast instanceof ASTList)) return ast.map(validateListDefaultSentinels);
        const args = ast.values.map(validateListDefaultSentinels);
        // Special case for empty list
        if (args.length === 1 && args[0] instanceof ASTDefaultPlaceholder) {
            return new ASTList(ast.location, []);
        }
        for (var i = 0; i < args.length; i++) {
            const el = args[i]!;
            if (el instanceof ASTDefaultPlaceholder) {
                throw new ParseError((i + 1) === args.length ? "illegal trailing comma in list" : "empty elements not allowed in list", el.location, [new ErrorNote("note: list starts here", ast.location)]);
            }
        }
        return ast;
    }

];

export function transformAST(ast: AST): AST {
    for (var transformer of TRANSFORM_PASSES) {
        ast = transformer(ast);
    }
    return ast;
}
