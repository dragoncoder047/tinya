import { AST } from "./ast";
import { parseTokens } from "./core";
import { tokenize } from "./tokenizer";
import { transformAST } from "./transformers";

export function parse(src: string, filename: string): AST {
    return transformAST(parseTokens(tokenize(src, filename))).constantFold();
}

/*

next steps to handle AST:

1. expand node names
2. expand and interpolate enum names
3. constant folding for constant+constant expressions
4. expand macros, if expansion was done then back to 1
5. do type checks

*/
