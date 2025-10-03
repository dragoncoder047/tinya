import { AST } from "./ast";

export function isPipe(a: AST.Node): a is AST.BinaryOp {
    return a instanceof AST.BinaryOp && a.op === "|>";
}

export function countPlaceholdersIn(expr: AST.Node): number {
    var numPlaceholders = 0;
    const count = (ast: AST.Node) => {
        if (ast instanceof AST.PipePlaceholder) numPlaceholders++;
        if (isPipe(ast)) {
            ast.left.pipe(count);
        } else {
            ast.pipe(count);
        }
        return ast;
    }
    count(expr);
    return numPlaceholders;
}

export function replacePlaceholdersWith(ast: AST.Node, with_: AST.Node): AST.Node {
    if (ast instanceof AST.PipePlaceholder) {
        return with_;
    } else if (isPipe(ast)) {
        return ast.pipe(a => a === ast.left ? a : replacePlaceholdersWith(a, with_));
    } else {
        return ast.pipe(a => replacePlaceholdersWith(a, with_))
    }
}
