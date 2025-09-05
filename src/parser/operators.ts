import { ParseError } from "./errors";
import type { Token } from "./tokenizer";

export const OPS: Record<string, [binary: number | undefined, unary?: number, right?: boolean]> = {
    "#": [, -1], // length
    "!": [, -1], // boolean NOT
    "^": [0, , true], // power
    "*": [2], // multiply
    "/": [2], // divide
    "+": [3], // add
    "-": [3, 1], // subtract, negate
    "||": [5], // boolean OR
    "&&": [5], // boolean AND
    "==": [6], // comparison
    ">=": [6], // comparson
    ">": [6],
    "<=": [6], // comparison
    "<": [6],
    "!=": [6], // comparison
    "|>": [7], // pipe
    "*>": [7], // each pipe
    "+>": [7], // reduce pipe
    ":": [8], // conditional part 1 (treated as binary and postprocessed for simplicity)
    "?": [9], // conditional part 2
    "=": [10], // assignment operator
    ",": [11], // separator
};

export const OP_REGEX = new RegExp(`^(${Object.keys(OPS).sort((a, b) => b.length - a.length).map(e => e.replaceAll(/([()[\]{}*+?|^])/g, "\\$1")).join("|")})`);
console.log(OP_REGEX);

export function getPrecedenceSloppy(token: string, unary: 1 | 0): number | undefined {
    return OPS[token]![unary];
}

export function getPrecedence(token: Token, unary: 1 | 0): number {
    const mePrecedence = getPrecedenceSloppy(token.text, unary);
    if (mePrecedence === undefined) {
        throw new ParseError(`${JSON.stringify(token.text)} is not valid as a ${["binary", "unary"][unary]} operator`, token.location);
    }
    return mePrecedence;
}

export function isRightAssociative(token: string): boolean {
    return !!OPS[token]![2];
}

