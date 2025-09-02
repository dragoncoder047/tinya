// #region Errors

interface ErrorDetails {
    expected?: string[];
    unexpected?: string;
}

export class ParseError extends Error {
    constructor(message: string, public error: ErrorDetails, public line: number, public col: number) {
        super(message);
    }
    displayOn(src: string): string {
        const lines = src.split("\n");
        const relevantLine = lines[this.line] || "";
        const msg = this.message + (this.error.expected ? ` (expected: ${this.error.expected!.map((s, i, a) => JSON.stringify(s) + (i === a.length - 1 ? "" : i === a.length - 2 ? (a.length > 2 ? ", or " : " or ") : ", ")).join("")})` : "") + (this.error.unexpected ? ` (unexpected ${JSON.stringify(this.error.unexpected)})` : "");
        return `Error: ${msg} (at ${this.line + 1}:${this.col + 1})\n${relevantLine}\n${" ".repeat(this.col)}^`;
    }
}

// #endregion

// #region Tokenizer

enum TokenType {
    NAME,
    NAME_REF,
    NAME_DEF,
    NUMBER,
    PAREN,
    OP,
}

interface Token {
    line: number;
    col: number;
    text: string;
    type: TokenType;
}

type Rule = [State[], ...([1, RegExp, TokenType] | [0, RegExp, undefined]), State | undefined]

enum State {
    INITIAL,
    BLOCK_COMMENT,
    POP,
}

const TOKENIZE_RULES: Rule[] = [
    [[State.INITIAL], 0, /^\/\/[^\n]*/, , ,],
    [[State.INITIAL, State.BLOCK_COMMENT], 0, /^\/\*/, , State.BLOCK_COMMENT],
    [[State.BLOCK_COMMENT], 0, /^\*\//, , State.POP],
    [[State.BLOCK_COMMENT], 0, /^((?!(\*\/)|(\/\*)).)+/, , ,],
    [[State.INITIAL], 1, /^-?(\.\d+|\d+\.?\d*)(e[+-]?\d+)?/i, TokenType.NUMBER, ,],
    [[State.INITIAL], 1, /^(\*\*|\|>|[-+*\/,])/, TokenType.OP, ,],
    [[State.INITIAL], 1, /^[()[\]{}]/, TokenType.PAREN, ,],
    [[State.INITIAL], 1, /^\w+/, TokenType.NAME, ,],
    [[State.INITIAL], 1, /^#\w+#/, TokenType.NAME_REF, ,],
    [[State.INITIAL], 1, /^#\w+=/, TokenType.NAME_DEF, ,],
    [[State.INITIAL, State.BLOCK_COMMENT], 0, /^[\s\n]+/, , ,],
];

function tokenize(source: string) {
    var line = 0, col = 0;
    const out: Token[] = [];
    const stateStack: State[] = [State.INITIAL];
    tokens: while (source.length > 0) {
        for (var [curStates, keep, regex, type, newState] of TOKENIZE_RULES) {
            if (curStates.every(s => stateStack.at(-1) !== s)) continue;
            const match = regex.exec(source);
            if (match) {
                const chunk = match[0];
                if (keep) out.push({ line, col, text: chunk, type } as Token);
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
        throw new ParseError("", { unexpected: source[0]! }, line, col);
    }
    return out;
}

// #endregion


export enum ASTType {
    CONSTANT,
    ENUM_CONSTANT,
    NAME_REF,
    NAME_DEF,
    NODE,
    LIST,
    MACRO,
    EXPRESSION,
}

export type AST = [ASTType, ...(AST | number | string)[]];

// #region Parser

function shunting_yard(tokens: (AST | string)[]): AST {
    const opStack: string[] = [];
    const valueStack: AST[] = [];
    const popOperator = () => {
        var right = valueStack.pop()!;
        var left = valueStack.pop()!;
        var op = opStack.pop()!;
        valueStack.push([ASTType.EXPRESSION, left, op, right]);
    };
    for (var token of tokens) {
        if (Array.isArray(token)) {
            valueStack.push(token);
        } else if (token === "(") {
            opStack.push(token);
        } else if (token === ")") {
            while (opStack.length > 0 && opStack.at(-1) !== "(") popOperator();
            opStack.pop();
        } else {
            var temp: string;
            while (opStack.length > 0 && (temp = opStack.at(-1)!) !== "(" && precedenceOf(token) >= precedenceOf(temp)) popOperator();
            opStack.push(token);
        }
    }
    while (opStack.length > 0) popOperator();
    if (valueStack.length === 1) return valueStack[0]!;
    throw "unreachable";
}

const PRECEDENCE_LEVELS = [
    ["**"],
    ["*", "/"],
    ["+", "-"],
    ["|>"],
    [","]
];

function precedenceOf(p: string) {
    return PRECEDENCE_LEVELS.findIndex(level => level.includes(p));
}

function lift_commas(expr: AST): AST[] {
    return expr[0] === ASTType.EXPRESSION && expr[2] === "," ? [...lift_commas(expr[1] as AST), ...lift_commas(expr[3] as AST)] : [expr];
};

function parse_from_tokens(tokens: Token[]): AST {
    var pos = 0;
    const nextToken = <T extends boolean>(expect: T): T extends true ? Token : Token | undefined => {
        if (expect && pos >= tokens.length) {
            const last = tokens.at(-1);
            throw new ParseError("", { unexpected: "EOF" }, last?.line ?? 0, last?.col ?? 0);
        }
        return tokens[pos++]!;
    };
    /*
    THING := NAME_DEF | NAME_REF | NODE | LIST | MACRO | EXPR | CONSTANT
    CONSTANT := number | name with no paren after it
    NAME_REF := '#name#'
    NAME_DEF := '#name=' + THING
    NODE := name + '(' + ARGS + ')'
    ARGS := (expression, but with commas lifted)
    LIST := '[' + ARGS + ']'
    MACRO := name + '{' + ARGS + '}'
    EXPR := THING + (OP + THING)* | '(' + THING + ')'
    */
    const parse_thing = (require_next: boolean): AST | undefined => {
        const token = nextToken(require_next);
        if (token === undefined) return undefined;
        switch (token.type) {
            case TokenType.NUMBER:
                return [ASTType.CONSTANT, parseFloat(token.text), token.line, token.col];
            case TokenType.NAME_REF:
                return [ASTType.NAME_REF, token.text.slice(1, -1), token.line, token.col];
            case TokenType.NAME_DEF:
                return [ASTType.NAME_DEF, token.text.slice(1, -1), parse_thing(true)!, token.line, token.col];
            case TokenType.NAME:
                const after = nextToken(false);
                if (after && after.text === "(") {
                    return [ASTType.NODE, token.text, ...lift_commas(parse_expression(")", true))];
                }
                if (after && after.text === "{") {
                    return [ASTType.MACRO, token.text, ...lift_commas(parse_expression("}", true))];
                }
                pos--; // make it a peek
                return [ASTType.ENUM_CONSTANT, token.text];
            case TokenType.PAREN:
                switch (token.text) {
                    case "[":
                        return [ASTType.LIST, ...lift_commas(parse_expression("]", true))];
                    case "(":
                        return parse_expression(")", false);
                }

        }
        throw new ParseError("", { unexpected: token.text }, token.line, token.col);
    };
    const parse_expression = (end: string, isArgs: boolean): AST => {
        const stuff: (AST | string)[] = [];
        for (; ;) {
            const thing = parse_thing(false);
            if (thing === undefined) break;
            stuff.push(thing);
            const tok = nextToken(true);
            if (tok.text === end) break;
            if (tok.type !== TokenType.OP) {
                throw new ParseError("missing" + (isArgs ? " comma?" : " operator?"), { unexpected: tok.text }, tok.line, tok.col);
            }
            stuff.push(tok.text);
        }
        return shunting_yard(stuff);
    };
    return parse_thing(true)!;
}

// #endregion

export function parse(s: string): AST {
    return parse_from_tokens(tokenize(s));
}

// TEST
const src = `
foo(a + a, [c+d, e] |> var(123), bar(x ** 2, y / (z - 1)),
// Single line comment
#myVar=macro{[1,2,3], #ref#}, baz(qux(4, 5), arr([6,7]) + 8),
/*
Multi-line comment /* nested */ comments */ (alpha - beta) * gamma / delta |> omega)
`;

try {
    const res = parse(src);
    console.log(JSON.stringify(res));
} catch (e) {
    const error = e as ParseError;
    console.error(error.displayOn(src));
}
