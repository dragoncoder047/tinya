import { isinstance } from "../utils";
import { AST } from "./ast";

export function isPipe(a: AST.Node): a is AST.BinaryOp {
    return isinstance(a, AST.BinaryOp) && a.op === "|>";
}

export async function countPlaceholdersIn(expr: AST.Node): Promise<number> {
    var numPlaceholders = 0;
    const count = async (ast: AST.Node) => {
        if (isinstance(ast, AST.PipePlaceholder)) numPlaceholders++;
        if (isPipe(ast)) {
            await ast.left.pipe(count);
        } else {
            await ast.pipe(count);
        }
        return ast;
    }
    await count(expr);
    return numPlaceholders;
}

export async function replacePlaceholdersWith(ast: AST.Node, with_: AST.Node): Promise<AST.Node> {
    if (isinstance(ast, AST.PipePlaceholder)) {
        return with_;
    } else if (isPipe(ast)) {
        return await ast.pipe(async a => a === ast.left ? a : await replacePlaceholdersWith(a, with_));
    } else {
        return await ast.pipe(async a => await replacePlaceholdersWith(a, with_))
    }
}
