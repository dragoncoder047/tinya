import { str } from "../utils";
import { AST } from "./ast";
import { parseTokens } from "./core";
import { ParseError } from "./errors";
import { tokenize } from "./tokenizer";
import { transformAST } from "./transformers";

export function parse(src: string, filename: string): AST {
    return transformAST(parseTokens(tokenize(src, filename)));
}

/*

next steps to handle AST:

1. expand node names
2. expand and interpolate enum names
3. constant folding for constant+constant expressions
4. expand macros, if expansion was done then back to 1
5. do type checks

*/

// TEST
const src = `[a+a, a, a]`;

try {
    const res = parse(src, "<string>");
    console.log(str(res, null, 2));
} catch (e) {
    if (e instanceof ParseError)
        console.error(e.displayOn({ "<string>": src }));
    else throw e;
}
