import { str } from "../utils";
import { AST, ASTBinaryOp, ASTConstant, ASTDefine, ASTInterpolation, ASTList, ASTNameReference, ASTCall, ASTParameterDescriptor, ASTStringConstant, ASTSymbol, ASTTemplate } from "./ast";
import { ErrorNote, ParseError } from "./errors";
import { treeifyExpression } from "./expression";
import { Token, TokenType } from "./tokenizer";


export function liftCommas(expr: AST, force = false): AST[] {
    return expr instanceof ASTBinaryOp && expr.op === "," && (force || !expr.noLift) ? [...liftCommas(expr.left), ...liftCommas(expr.right)] : [expr];
}

// string string string
function unescape(string: string): string {
    return ({
        a: "\a", b: "\b", e: "\e", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", z: "\0", "'": "'", "\"": "\"", "\\": "\\",
        x: false as const,
        u: false as const
    }[string.toLowerCase()[0]!] ?? string) || String.fromCodePoint(parseInt(/[0-9a-f]+/i.exec(string)![0], 16));
}

export function parseTokens(tokens: Token[]): AST {
    var pos = 0;
    const nextToken = <T extends boolean>(expect: T, beginParen?: Token): T extends true ? Token : Token | undefined => {
        if (expect && pos >= tokens.length) {
            if (beginParen) {
                throw new ParseError(`${str(beginParen.text)} was never closed`, beginParen.location);
            }
            const last = tokens.at(-1);
            throw new ParseError("unexpected EOF", last?.location);
        }
        return tokens[pos++]!;
    };
    const parseString = (start: Token): ASTStringConstant => {
        var out = "";
        str: for (; ;) {
            const token = nextToken(true, start);
            switch (token.type) {
                case TokenType.STRING_END:
                    break str;
                case TokenType.STRING_BODY:
                    out += token.text;
                    break;
                case TokenType.STRING_ESC:
                    out += unescape(token.text.slice(1));
                    break;
                case TokenType.INVALID_STRING_ESCAPE:
                    throw new ParseError("illegal escape sequence", token.location);
            }
        }
        return new ASTStringConstant(start.location, out);
    }
    const parseThing = (requireNext: boolean, beginParen?: Token): AST | undefined => {
        const token = nextToken(requireNext, beginParen);
        if (token === undefined) return undefined;
        switch (token.type) {
            case TokenType.NUMBER:
                return new ASTConstant(token.location, parseFloat(token.text));
            case TokenType.STRING_BEGIN:
                return parseString(token);
            case TokenType.NAME:
                const after = nextToken(false);
                if (after && after.text === "(") {
                    return new ASTCall(token.location, token.text, liftCommas(parseExpression(")", after), true));
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
                        return new ASTList(token.location, liftCommas(parseExpression("]", token), true));
                    case "(":
                        return parseExpression(")", token, true);
                    case ")":
                    case "]":
                    case "}":
                        throw new ParseError(beginParen ? `expected ${str({ "(": ")", "[": "]", "{": "}" }[beginParen.text])}` : "stray close paren", token.location, beginParen ? [new ErrorNote("note: to match this " + str(beginParen.text), beginParen.location)] : []);
                }
            case TokenType.OPERATOR:
                if (!requireNext && (token.text === "," || token.text === ")")) {
                    pos--;
                    return;
                }
        }
        throw new ParseError(`unexpected ${{ [TokenType.NAME]: "name", [TokenType.OPERATOR]: "operator" }[token.text] ?? str(token.text)}`, token.location);
    };
    const parseExpression = (end: string | false, beginParen?: Token, lift = false): AST => {
        const exprItems: (AST | Token)[] = [];
        for (; ;) {
            var tok = nextToken(!!end, beginParen);
            if (!end && tok === undefined) break;
            if (tok!.text === end) break;
            switch (tok!.type) {
                case TokenType.OPERATOR:
                    exprItems.push(tok!);
                    break;
                default:
                    pos--;
                    const thing = parseThing(false, beginParen);
                    if (thing !== undefined) exprItems.push(thing);
            }
        }
        return treeifyExpression(exprItems, lift);
    };
    return parseExpression(false);
}
