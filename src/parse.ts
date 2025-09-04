// #region Errors

export class LocationTrace {
    constructor(
        public line: number,
        public col: number,
        public filename: string,
        public parentNote?: string,
        public parent?: LocationTrace) { }
    withSourceNote(note: string, src: LocationTrace = this) {
        return new LocationTrace(this.line, this.col, this.filename, note, src);
    }

    static unknown = new LocationTrace(0, 0, "unknown");
}

function formatTrace(trace: LocationTrace, message: string, sources: Record<string, string>): string {
    const src = sources[trace.filename] ?? "";
    const lines = src.split("\n");
    const relevantLine = lines[trace.line] || "";
    const lineNumberString = trace.line + 1 + "";
    return `${trace.filename}:${trace.line + 1}:${trace.col + 1}: ${message}\n${lineNumberString} | ${relevantLine}\n${" ".repeat(lineNumberString.length)} | ${" ".repeat(trace.col)}^${trace.parent ? `\n${formatTrace(trace.parent, trace.parentNote!, sources)}` : ""}`;
}

export class ParseError extends Error {
    constructor(message: string, public trace: LocationTrace = LocationTrace.unknown) {
        super(message);
    }
    displayOn(sources: Record<string, string>): string {
        return formatTrace(this.trace, "error: " + this.message, sources);
    }
}

// #endregion

// #region Tokenizer

enum TokenType {
    NAME = "NAME",
    NUMBER = "NUMBER",
    PAREN = "PAREN",
    OPERATOR = "OPERATOR",
    ASSIGN = "ASSIGN",
    DEFINE = "DEFINE",
    SYMBOL = "SYMBOL",
    INTERPOLATE = "INTERPOLATE",
}

class Token {
    constructor(public text: string,
        public location: LocationTrace,
        public type: TokenType,
        public assign?: LocationTrace) { }
}

type Rule = [State[], RegExp, TokenType | undefined, State | undefined]

enum State {
    INITIAL = "INITIAL",
    BLOCK_COMMENT = "BLOCK_COMMENT",
    POP = "POP",
}

const TOKENIZE_RULES: Rule[] = [
    [[State.INITIAL], /^\/\/[^\n]*/, , ,],
    [[State.INITIAL, State.BLOCK_COMMENT], /^\/\*/, , State.BLOCK_COMMENT],
    [[State.BLOCK_COMMENT], /^\*\//, , State.POP],
    [[State.BLOCK_COMMENT], /^((?!(\*\/)|(\/\*)).)+/, , ,],
    [[State.INITIAL], /^(\.\d+|\d+\.?\d*)(e[+-]?\d+)?/i, TokenType.NUMBER, ,],
    [[State.INITIAL], /^:-/, TokenType.DEFINE, ,],
    [[State.INITIAL], /^([|*+]>|&&|\|\||[!=<>]=|[-+*\/,:?#!<>^])/, TokenType.OPERATOR, ,],
    [[State.INITIAL], /^=/, TokenType.ASSIGN, ,],
    [[State.INITIAL], /^&/, TokenType.INTERPOLATE, ,],
    [[State.INITIAL], /^[()[\]{}]/, TokenType.PAREN, ,],
    [[State.INITIAL], /^\.\w+/, TokenType.SYMBOL, ,],
    [[State.INITIAL], /^\w+/, TokenType.NAME, ,],
    [[State.INITIAL, State.BLOCK_COMMENT], /^[\s\n]+/, , ,],
];

function tokenize(source: string, filename: string) {
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

// #endregion

// #region AST

export enum ASTType {
    CONSTANT = "CONSTANT",
    SYMBOL = "SYMBOL",
    NAME_REF = "NAME_REF",
    ASSIGN = "ASSIGN",
    NODE = "NODE",
    LIST = "LIST",
    DEFINE = "DEFINE",
    TEMPLATE = "TEMPLATE",
    INTERPOLATION = "INTERPOLATION",
    BINARY_OP = "BINARY_OP",
    UNARY_OP = "UNARY_OP",
    CONDITIONAL = "CONDITIONAL",
    DEFAULT = "DEFAULT",
    BLOCK = "BLOCK",
}

export abstract class AST {
    constructor(public type: ASTType, public location: LocationTrace) { }
    abstract edgemost(left: boolean): AST;
    map(fn: (node: AST) => AST): AST { return this; }
}

export class ASTConstant extends AST {
    constructor(trace: LocationTrace, public value: number) { super(ASTType.CONSTANT, trace) };
    edgemost() { return this; }
}

export class ASTSymbol extends AST {
    constructor(trace: LocationTrace, public value: string) { super(ASTType.SYMBOL, trace) };
    edgemost() { return this; }
}

export class ASTAssignment extends AST {
    constructor(trace: LocationTrace, public name: string, public value: AST) { super(ASTType.ASSIGN, trace) };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTAssignment(this.location, this.name, fn(this.value)); }
}

export class ASTNameReference extends AST {
    constructor(trace: LocationTrace, public name: string) { super(ASTType.NAME_REF, trace) };
    edgemost() { return this; }
}

export class ASTNodeCall extends AST {
    constructor(trace: LocationTrace, public name: string, public args: AST[]) { super(ASTType.NODE, trace) };
    edgemost(left: boolean): AST { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
    map(fn: (node: AST) => AST) { return new ASTNodeCall(this.location, this.name, this.args.map(fn)); }
}

export class ASTList extends AST {
    constructor(trace: LocationTrace, public values: AST[]) { super(ASTType.LIST, trace) };
    edgemost(left: boolean): AST { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
    map(fn: (node: AST) => AST) { return new ASTList(this.location, this.values.map(fn)); }
}

export class ASTDefine extends AST {
    constructor(trace: LocationTrace, public name: string, public parameters: AST[], public body: AST) { super(ASTType.DEFINE, trace) };
    edgemost(left: boolean): AST { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTDefine(this.location, this.name, this.parameters.map(fn), fn(this.body)); }
}

export class ASTTemplate extends AST {
    constructor(trace: LocationTrace, public body: AST) { super(ASTType.TEMPLATE, trace) };
    edgemost(left: boolean): AST { return this.body.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTTemplate(this.location, fn(this.body)); }
}

export class ASTBinaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public left: AST, public right: AST) { super(ASTType.BINARY_OP, trace) };
    edgemost(left: boolean): AST { return this[left ? "left" : "right"].edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTBinaryOp(this.location, this.op, fn(this.left), fn(this.right)); }
}

export class ASTUnaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public value: AST) { super(ASTType.UNARY_OP, trace) };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTUnaryOp(this.location, this.op, fn(this.value)); }
}

export class ASTDefaultPlaceholder extends AST {
    constructor(trace: LocationTrace) { super(ASTType.DEFAULT, trace) };
    edgemost() { return this; }
}

export class ASTConditional extends AST {
    constructor(trace: LocationTrace, public cond: AST, public caseTrue: AST, public caseFalse: AST) { super(ASTType.CONDITIONAL, trace); }
    edgemost(left: boolean): AST { return (left ? this.cond : this.caseFalse).edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTConditional(this.location, fn(this.cond), fn(this.caseTrue), fn(this.caseFalse)); }
}

export class ASTInterpolation extends AST {
    constructor(trace: LocationTrace, public value: AST) { super(ASTType.INTERPOLATION, trace); }
    edgemost(left: boolean): AST { return this.value.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTInterpolation(this.location, fn(this.value)); }
}

export class ASTBlock extends AST {
    constructor(trace: LocationTrace, public children: AST[]) { super(ASTType.BLOCK, trace); }
    edgemost(left: boolean): AST { return this.children.length > 0 ? left ? this.children[0]!.edgemost(left) : this.children.at(-1)!.edgemost(left) : this; }
    map(fn: (node: AST) => AST) { return new ASTList(this.location, this.children.map(fn)); }
}

// #endregion

// #region Parser


const OPS: Record<string, [binary: number | undefined, unary?: number, right?: boolean]> = {
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

function getPrecedenceSloppy(token: string, unary: 1 | 0): number | undefined {
    return OPS[token]![unary];
}

function getPrecedence(token: Token, unary: 1 | 0): number {
    const mePrecedence = getPrecedenceSloppy(token.text, unary);
    if (mePrecedence === undefined) {
        throw new ParseError(`${JSON.stringify(token.text)} is not valid as a ${["binary", "unary"][unary]} operator`, token.location);
    }
    return mePrecedence;
}

function isRightAssociative(token: string): boolean {
    return !!OPS[token]![2];
}

// cSpell: ignore treeify
function treeifyExpression(tokens: (AST | Token)[], lastToken: Token | undefined): AST {
    // special case for nothing in the expression
    if (tokens.length === 0) return new ASTDefaultPlaceholder(lastToken?.location ?? LocationTrace.unknown);
    var i: number, firstToken: Token | undefined = undefined;
    for (i = 0; i < tokens.length - 1; i++) {
        const here = tokens[i]!;
        const next = tokens[i + 1]!;
        if (here instanceof Token) {
            if (firstToken === undefined) firstToken = here;
            if (next instanceof Token) {
                if (here.type === TokenType.OPERATOR && next.type === TokenType.ASSIGN) {
                    tokens.splice(i, 2, { ...here, assign: next.location });
                }
            }
            // special case for consecutive commas: insert default things in between
            if (here.type === TokenType.OPERATOR && here.text === ",") {
                if (next.type === TokenType.OPERATOR && next.text === ",") {
                    if (i === tokens.length - 2) {
                        tokens.push(new ASTDefaultPlaceholder(lastToken?.location ?? LocationTrace.unknown));
                    }
                    tokens.splice(i + 1, 0, new ASTDefaultPlaceholder(next.location));
                }
                if (i === 0) {
                    tokens.splice(0, 0, new ASTDefaultPlaceholder(here.location));
                }
            }
        }
    }
    // The algorithm is 'recursive lifting':
    // first try to find the highest precedence unary operator with no higher binary after its atom, and lift it into an atom
    // if no such unary exists find the highest precedence binary and lift it ito an atom
    // then repeat until there is only one atom
    while (tokens.length > 1) {
        // 'highest precedence' == lowest numerically
        var bestBinaryPrecedence = Infinity, bestBinaryIndex = -1;
        var bestUnaryPrecedence = Infinity, bestUnaryIndex = -1;
        var prevWasAtom = false;
        const lastAtomIndex = tokens.findLastIndex(e => e instanceof AST);
        for (i = 0; i < tokens.length; i++) {
            const token = tokens[i]!;
            if (token instanceof AST) prevWasAtom = true;
            else {
                if (i > lastAtomIndex) {
                    const tokenString = JSON.stringify(token.text);
                    throw new ParseError(`expected a value after operator, but got ${tokenString}`, (i - 1 > lastAtomIndex) && getPrecedenceSloppy(token.text, 1) === undefined ? token.location.withSourceNote(`note: ${tokenString} is not a valid unary operator either`) : token.location);
                }
                if (prevWasAtom) {
                    const precedence = getPrecedence(token, 0);
                    if (bestBinaryPrecedence > precedence || (bestBinaryPrecedence === precedence && isRightAssociative(token.text))) {
                        bestBinaryPrecedence = precedence;
                        bestBinaryIndex = i;
                    }
                } else {

                    switch (token.type) {
                        case TokenType.ASSIGN:
                            throw new ParseError("assignment not valid here", token.location);
                        case TokenType.OPERATOR:
                            // possible unary operator to lift
                            if (token.assign) {
                                throw new ParseError("cannot compound-assign as unary operator", token.assign);
                            }
                            const mePrecedence = getPrecedence(token, 1);
                            if (!(tokens[i + 1]! instanceof AST)) break; // not innermost unary
                            const opAfter = tokens[i + 2];
                            if (opAfter) {
                                if (opAfter instanceof AST) {
                                    // TODO: trigger this error when 2 atoms come before any operator (right now it triggers the 'unknown error')
                                    throw new ParseError("expected operator before value", opAfter.edgemost(true).location);
                                }
                                const opAfterPrecedence = getPrecedence(opAfter, 0);
                                if (opAfterPrecedence < mePrecedence) break; // don't lift yet
                            }
                            // we can lift this
                            if (bestUnaryPrecedence > mePrecedence) {
                                bestUnaryPrecedence = mePrecedence;
                                bestUnaryIndex = i;
                            }
                    }
                }
                prevWasAtom = false;
            }
        }
        if (bestUnaryIndex >= 0) {
            const [op, val] = tokens.splice(bestUnaryIndex, 2) as [Token, AST];
            tokens.splice(bestUnaryIndex, 0, new ASTUnaryOp(op.location, op.text, val));
        } else if (bestBinaryIndex >= 0) {
            const [left, op, right] = tokens.splice(bestBinaryIndex - 1, 3) as [AST, Token, AST];
            if (op.type === TokenType.ASSIGN) {
                if (!(left instanceof ASTNameReference)) {
                    throw new ParseError("invalid assignment target", left.edgemost(false).location.withSourceNote("note: assignment was here:", op.location));
                }
                tokens.splice(bestBinaryIndex - 1, 0,)
            } else {
                const math = new ASTBinaryOp(op.location, op.text, left, right);
                if (op.assign) {
                    if (!(left instanceof ASTNameReference)) {
                        throw new ParseError("invalid target of compound assignment", left.edgemost(false).location.withSourceNote("note: assignment was here:", op.assign));
                    }
                    tokens.splice(bestBinaryIndex - 1, 0, new ASTAssignment(op.assign, left.name, math));
                } else tokens.splice(bestBinaryIndex - 1, 0, math);
            }
        } else {
            throw new ParseError("unknown error in expression parsing", firstToken?.location);
        }
    }
    return tokens[0] as AST;
}

function liftCommas(expr: AST): AST[] {
    return expr instanceof ASTBinaryOp && expr.op === "," ? [...liftCommas(expr.left), ...liftCommas(expr.right)] : [expr];
}

function parseTokens(tokens: Token[]): AST {
    var pos = 0;
    const nextToken = <T extends boolean>(expect: T, beginParen?: Token): T extends true ? Token : Token | undefined => {
        if (expect && pos >= tokens.length) {
            if (beginParen) {
                throw new ParseError(`${JSON.stringify(beginParen.text)} was never closed`, beginParen.location);
            }
            const last = tokens.at(-1);
            throw new ParseError("unexpected EOF", last?.location);
        }
        return tokens[pos++]!;
    };
    const parseThing = (requireNext: boolean, beginParen?: Token): AST | undefined => {
        const token = nextToken(requireNext, beginParen);
        if (token === undefined) return undefined;
        var after: Token | undefined;
        switch (token.type) {
            case TokenType.NUMBER:
                return new ASTConstant(token.location, parseFloat(token.text));
            case TokenType.SYMBOL:
                return new ASTSymbol(token.location, token.text.slice(1));
            case TokenType.INTERPOLATE:
                const value = parseThing(false, beginParen);
                if (!value) {
                    throw new ParseError('expected value after "&"', token.location);
                }
                return new ASTInterpolation(token.location, value);
            case TokenType.NAME:
                after = nextToken(false);
                if (after && after.text === "(") {
                    const headerOrBody = liftCommas(parseExpression(")", after));
                    after = nextToken(false);
                    if (after && after.type === TokenType.DEFINE) {
                        return new ASTDefine(token.location, token.text, headerOrBody, parseThing(false)!);
                    } else {
                        pos--;
                        return new ASTNodeCall(token.location, token.text, headerOrBody);
                    }
                }
                pos--; // make it a peek
                return new ASTNameReference(token.location, token.text);
            // @ts-expect-error
            // fallthrough is intentional!
            case TokenType.PAREN:
                switch (token.text) {
                    case "{":
                        return new ASTTemplate(token.location, parseExpression("}", token));
                    case "[":
                        return new ASTList(token.location, liftCommas(parseExpression("]", token)));
                    case "(":
                        return parseExpression(")", token);
                    case ")":
                    case "]":
                    case "}":
                        throw new ParseError("stray close paren", beginParen ? token.location.withSourceNote("note: to match this " + JSON.stringify(beginParen.text), beginParen.location) : token.location);
                }
            case TokenType.OPERATOR:
                if (!requireNext && (token.text === "," || token.text === ")")) {
                    pos--;
                    return;
                }
        }
        throw new ParseError(`unexpected ${{ [TokenType.NAME]: "name", [TokenType.SYMBOL]: "symbol", [TokenType.OPERATOR]: "operator" }[token.text] ?? JSON.stringify(token.text)}`, token.location);
    };
    const parseExpression = (end: string | false, beginParen?: Token): AST => {
        const exprItems: (AST | Token)[] = [];
        var lastToken: Token;
        for (; ;) {
            var tok = nextToken(!!end, beginParen);
            if (!end && tok === undefined) break;
            if (tok!.text === end) break;
            lastToken = tok!;
            switch (tok!.type) {
                case TokenType.OPERATOR:
                case TokenType.ASSIGN:
                    exprItems.push(tok!);
                    break;
                default:
                    pos--;
                    exprItems.push(parseThing(false, beginParen) ?? new ASTDefaultPlaceholder(lastToken.location));
            }
        }
        return treeifyExpression(exprItems, lastToken!);
    };
    return parseExpression(false);
}

// #endregion

// #region Transformers

function chainTransformers(ast: AST, transformers: ((ast: AST) => AST)[]): AST {
    return transformers.reduce((ast, fun) => fun(ast), ast);
}

function expandTernaryOperators(ast: AST): AST {
    if (!(ast instanceof ASTBinaryOp) || ast.op !== "?") return ast.map(expandTernaryOperators);
    const condition = ast.left.map(expandTernaryOperators);
    const choices = ast.right.map(expandTernaryOperators);
    if (!(choices instanceof ASTBinaryOp) || choices.op !== ":") {
        throw new ParseError('expected ":" after expression', (choices instanceof ASTBinaryOp ? choices : choices.edgemost(false)).location.withSourceNote('note: "?" is here:', ast.location));
    }
    return new ASTConditional(ast.location, condition, choices.left, choices.right);
}

function commasToBlocks(ast: AST): AST {
    if (!(ast instanceof ASTBinaryOp) || ast.op !== ",") return ast.map(commasToBlocks);
    return new ASTBlock(ast.edgemost(true).location, liftCommas(ast).map(commasToBlocks));
}

function validateDefaults(ast: AST): AST {
    // TODO
    return ast;
}

function liftKeywordArguments(ast: AST): AST {
    // TODO
    return ast;
}

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
const src = `a |>      =   c`;

try {
    const res = parse(src, "stdin");
    console.log(JSON.stringify(res, null, 2));
} catch (e) {
    if (e instanceof ParseError)
        console.error(e.displayOn({ stdin: src }));
    else throw e;
}
