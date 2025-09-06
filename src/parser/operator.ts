import { OPERATORS } from "../operators";
import { ParseError } from "./errors";
import type { Token } from "./tokenizer";
import { str } from "../utils";


export const OP_REGEX = new RegExp(`^(${Object.keys(OPERATORS).sort((a, b) => b.length - a.length).map(e => e.replaceAll(/([()[\]{}*+?|^$\\.])/g, "\\$1")).join("|")})`);

export function getPrecedenceSloppy(token: string, unary: boolean): number | undefined {
    return OPERATORS[token]![unary ? "unary" : "bin"];
}

export function getPrecedence(token: Token, unary: boolean): number {
    const mePrecedence = getPrecedenceSloppy(token.assign ? "=" : token.text, unary);
    if (mePrecedence === undefined) {
        throw new ParseError(`${str(token.text + (token.assign ? "=" : ""))} is not valid as a ${["binary", "unary"][+unary]} operator`, token.location);
    }
    return mePrecedence;
}

export function isRightAssociative(token: string): boolean {
    return OPERATORS[token]!.right;
}
