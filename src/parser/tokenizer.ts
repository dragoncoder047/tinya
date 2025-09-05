import { LocationTrace, ParseError } from "./errors";
import { OP_REGEX } from "./operators";

export enum TokenType {
    NAME = "NAME",
    NUMBER = "NUMBER",
    PAREN = "PAREN",
    OPERATOR = "OPERATOR",
    ASSIGN = "ASSIGN",
    DEFINE = "DEFINE",
    SYMBOL = "SYMBOL",
    INTERPOLATE = "INTERPOLATE"
}

export class Token {
    constructor(public text: string,
        public location: LocationTrace,
        public type: TokenType,
        public assign?: LocationTrace) { }
}

type Rule = [State[], RegExp, TokenType | undefined, State | undefined];

enum State {
    INITIAL = "INITIAL",
    BLOCK_COMMENT = "BLOCK_COMMENT",
    POP = "POP"
}

const TOKENIZE_RULES: Rule[] = [
    [[State.INITIAL], /^\/\/[^\n]*/, , ,],
    [[State.INITIAL, State.BLOCK_COMMENT], /^\/\*/, , State.BLOCK_COMMENT],
    [[State.BLOCK_COMMENT], /^\*\//, , State.POP],
    [[State.BLOCK_COMMENT], /^((?!(\*\/)|(\/\*)).)+/, , ,],
    [[State.INITIAL], /^(\.\d+|\d+\.?\d*)(e[+-]?\d+)?/i, TokenType.NUMBER, ,],
    [[State.INITIAL], /^:-/, TokenType.DEFINE, ,],
    [[State.INITIAL], OP_REGEX, TokenType.OPERATOR, ,],
    [[State.INITIAL], /^=/, TokenType.ASSIGN, ,],
    [[State.INITIAL], /^&/, TokenType.INTERPOLATE, ,],
    [[State.INITIAL], /^[()[\]{}]/, TokenType.PAREN, ,],
    [[State.INITIAL], /^\.\w+/, TokenType.SYMBOL, ,],
    [[State.INITIAL], /^\w+/, TokenType.NAME, ,],
    [[State.INITIAL, State.BLOCK_COMMENT], /^[\s\n]+/, , ,],
];

export function tokenize(source: string, filename: string) {
    var line = 0, col = 0;
    const out: Token[] = [];
    const stateStack: State[] = [State.INITIAL];
    tokens: while (source.length > 0) {
        for (var [curStates, regex, type, newState] of TOKENIZE_RULES) {
            if (curStates.every(s => stateStack.at(-1) !== s)) continue;
            const match = regex.exec(source);
            if (match) {
                const chunk = match[0];
                if (type !== undefined) out.push(new Token(chunk, new LocationTrace(line, col, filename), type));
                const interlines = chunk.split("\n");
                if (interlines.length > 1) {
                    col = interlines.at(-1)!.length;
                    line += interlines.length - 1;
                } else {
                    col += chunk.length;
                }
                source = source.slice(chunk.length);
                if (newState !== undefined) {
                    if (newState === State.POP) stateStack.pop();
                    else stateStack.push(newState);
                }
                continue tokens;
            }
        }
        throw new ParseError(`unexpected ${JSON.stringify(source[0])}`, new LocationTrace(line, col, filename));
    }
    return out;
}
