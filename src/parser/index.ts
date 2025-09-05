import { AST } from "./ast";
import { parseTokens } from "./core";
import { ParseError } from "./errors";
import { tokenize } from "./tokenizer";
import { chainTransformers, commasToBlocks, expandTernaryOperators, liftKeywordArguments, validateDefaults } from "./visitors";

// #endregion

export function parse(src: string, filename: string): AST {
    return chainTransformers(parseTokens(tokenize(src, filename)), [
        expandTernaryOperators,
        commasToBlocks,
        validateDefaults,
        liftKeywordArguments,
    ]);
}

/*

next steps to handle AST:

1. expand node names
2. expand and interpolate enum names
3. constant folding for constant+constant expressions
4. expand macros, if done then back to 1
5. do type checks

*/

// TEST
const src = `foo(a:,b:,c)`;

try {
    const res = parse(src, "stdin");
    console.log(JSON.stringify(res, null, 2));
} catch (e) {
    if (e instanceof ParseError)
        console.error(e.displayOn({ stdin: src }));
    else throw e;
}
