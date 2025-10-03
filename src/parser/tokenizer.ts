import { str } from "../utils";
import { LocationTrace, ParseError } from "./errors";
import { OP_REGEX } from "./operator";

export enum TokenType {
    NAME,
    NUMBER,
    PAREN,
    OPERATOR,
    PIPE_PLACEHOLDER,
    STRING_BEGIN,
    STRING_END,
    STRING_BODY,
    STRING_ESC,
    INVALID_STRING_ESCAPE,
}

export class Token {
    constructor(public t: string,
        public s: LocationTrace,
        public k: TokenType,
        public a?: LocationTrace) { }
}

type Rule = [State[], RegExp, keepType?: TokenType | undefined, stateOp?: State | undefined];

enum State {
    INITIAL,
    BLOCK_COMMENT,
    STRING,
    RAW_STRING,
    POP,
}

const TOKENIZE_RULES: Rule[] = [
    // comments
    [[State.INITIAL], /^\/\/[^\n]*/],
    [[State.INITIAL, State.BLOCK_COMMENT], /^\/\*/, , State.BLOCK_COMMENT],
    [[State.BLOCK_COMMENT], /^\*\//, , State.POP],
    [[State.BLOCK_COMMENT], /^((?!(\*\/)|(\/\*)).)+/],
    // strings with escapes
    [[State.INITIAL], /^"/, TokenType.STRING_BEGIN, State.STRING],
    [[State.STRING], /^"/, TokenType.STRING_END, State.POP],
    [[State.STRING], /^\\[abefnrtvz'"\\]/, TokenType.STRING_ESC],
    [[State.STRING], /^\\(x[0-9a-f]{2}|u[0-9a-f]{4}|u\{[0-9a-f]+\})/i, TokenType.STRING_ESC],
    [[State.STRING], /^\\./, TokenType.INVALID_STRING_ESCAPE],
    [[State.STRING], /^[^\\"]+/, TokenType.STRING_BODY],
    // strings without escapes
    [[State.INITIAL], /^'/, TokenType.STRING_BEGIN, State.RAW_STRING],
    [[State.RAW_STRING], /^'/, TokenType.STRING_END, State.POP],
    [[State.RAW_STRING], /^\\'/, TokenType.STRING_ESC],
    [[State.RAW_STRING], /^\\./, TokenType.STRING_BODY],
    [[State.RAW_STRING], /^[^\\']+/, TokenType.STRING_BODY],
    // number
    [[State.INITIAL], /^-?(\.\d+|\d+\.?\d*)(e[+-]?\d+)?/i, TokenType.NUMBER],
    // operators
    [[State.INITIAL], OP_REGEX, TokenType.OPERATOR],
    // parens
    [[State.INITIAL], /^[()[\]{}]/, TokenType.PAREN],
    // names
    [[State.INITIAL], /^\w+/, TokenType.NAME],
    // discard whitespace elsewhere
    [[State.INITIAL, State.BLOCK_COMMENT], /^[\s\n]+/],
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
        throw new ParseError(`unexpected ${str(source[0])}`, new LocationTrace(line, col, filename));
    }
    return out;
}
