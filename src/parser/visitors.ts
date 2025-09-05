import { AST, ASTBinaryOp, ASTConditional, ASTBlock } from "./ast";
import { liftCommas } from "./core";
import { ParseError } from "./errors";

export function chainTransformers(ast: AST, transformers: ((ast: AST) => AST)[]): AST {
    return transformers.reduce((ast, fun) => fun(ast), ast);
}

export function expandTernaryOperators(ast: AST): AST {
    if (!(ast instanceof ASTBinaryOp) || ast.op !== "?") return ast.map(expandTernaryOperators);
    const condition = ast.left.map(expandTernaryOperators);
    const choices = ast.right.map(expandTernaryOperators);
    if (!(choices instanceof ASTBinaryOp) || choices.op !== ":") {
        throw new ParseError('expected ":" after expression', (choices instanceof ASTBinaryOp ? choices : choices.edgemost(false)).location.withSourceNote('note: "?" is here:', ast.location));
    }
    return new ASTConditional(ast.location, condition, choices.left, choices.right);
}

export function commasToBlocks(ast: AST): AST {
    if (!(ast instanceof ASTBinaryOp) || ast.op !== ",") return ast.map(commasToBlocks);
    return new ASTBlock(ast.edgemost(true).location, liftCommas(ast).map(commasToBlocks));
}

export function validateDefaults(ast: AST): AST {
    // TODO
    return ast;
}

export function liftKeywordArguments(ast: AST): AST {
    // TODO
    return ast;
}
