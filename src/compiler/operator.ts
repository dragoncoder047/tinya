import { INVALID, OPERATORS } from "../operators";
import { str } from "../utils";
import { ParseError } from "./errors";
import type { Token } from "./tokenizer";


export const OP_REGEX = new RegExp(`^(${Object.keys(OPERATORS).sort((a, b) => b.length - a.length).map(e => e.replaceAll(/([()[\]{}*+?|^$\\.])/g, "\\$1")).join("|")})`);

export function getPrecedenceSloppy(token: string, unary: boolean): number {
    return OPERATORS[token]![unary ? "u" : "b"] ?? INVALID;
}

export function getPrecedence(token: Token, unary: boolean): number {
    const keyOperator = token.a ? "=" : token.t;
    const realOperator = token.t + (token.a ? "=" : "")
    const mePrecedence = getPrecedenceSloppy(keyOperator, unary);
    if (mePrecedence === INVALID) {
        throw new ParseError(`${str(realOperator)} is not valid as a ${["binary", "unary"][+unary]} operator`, token.s);
    }
    return mePrecedence;
}

export function isRightAssociative(token: string): boolean {
    return OPERATORS[token]!.r;
}
