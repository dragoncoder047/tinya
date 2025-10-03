import { str } from "../utils";
import { AST } from "./ast";
import { ErrorNote, ParseError } from "./errors";
import { treeifyExpression } from "./expression";
import { Token, TokenType } from "./tokenizer";


export function liftCommas(expr: AST.Node, force = false): AST.Node[] {
    return expr instanceof AST.BinaryOp && /^[,;]$/.test(expr.op) && (force || !expr.noLift) ? [...liftCommas(expr.left), ...liftCommas(expr.right)] : [expr];
}

// string string string
function unescape(string: string): string {
    return ({
        a: "\a", b: "\b", e: "\e", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", z: "\0", "'": "'", "\"": "\"", "\\": "\\",
        x: false as const,
        u: false as const
    }[string.toLowerCase()[0]!] ?? string) || String.fromCodePoint(parseInt(/[0-9a-f]+/i.exec(string)![0], 16));
}

export function parseTokens(tokens: Token[]): AST.Node {
    var pos = 0;
    const nextToken = <T extends boolean>(expect: T, beginParen?: Token): T extends true ? Token : Token | undefined => {
        if (expect && pos >= tokens.length) {
            if (beginParen) {
                throw new ParseError(`${str(beginParen.t)} was never closed`, beginParen.s);
            }
            const last = tokens.at(-1);
            throw new ParseError("unexpected EOF", last?.s);
        }
        return tokens[pos++]!;
    };
    const parseString = (start: Token): AST.Constant => {
        var out = "";
        str: for (; ;) {
            const token = nextToken(true, start);
            switch (token.k) {
                case TokenType.STRING_END:
                    break str;
                case TokenType.STRING_BODY:
                    out += token.t;
                    break;
                case TokenType.STRING_ESC:
                    out += unescape(token.t.slice(1));
                    break;
                case TokenType.INVALID_STRING_ESCAPE:
                    throw new ParseError("illegal escape sequence", token.s);
            }
        }
        return new AST.Constant(start.s, out);
    }
    const parseThing = (requireNext: boolean, beginParen?: Token): AST.Node | undefined => {
        const token = nextToken(requireNext, beginParen);
        if (token === undefined) return undefined;
        switch (token.k) {
            case TokenType.NUMBER:
                return new AST.Constant(token.s, parseFloat(token.t));
            case TokenType.STRING_BEGIN:
                return parseString(token);
            case TokenType.NAME:
                const after = nextToken(false);
                if (after && after.t === "(") {
                    return new AST.Call(token.s, token.t, liftCommas(parseExpression(")", after), true));
                }
                pos--; // make it a peek
                return new AST.Name(token.s, token.t);
            // @ts-expect-error
            // fallthrough is intentional!
            case TokenType.PAREN:
                switch (token.t) {
                    case "{":
                        return new AST.Template(token.s, parseExpression("}", token));
                    case "[":
                        return new AST.List(token.s, liftCommas(parseExpression("]", token), true));
                    case "(":
                        return parseExpression(")", token, true);
                    case ")":
                    case "]":
                    case "}":
                        throw new ParseError(beginParen ? `expected ${str({ "(": ")", "[": "]", "{": "}" }[beginParen.t])}` : "stray close paren", token.s, beginParen ? [new ErrorNote("note: to match this " + str(beginParen.t), beginParen.s)] : []);
                }
            case TokenType.OPERATOR:
                if (!requireNext && /^[,;)]$/.test(token.t)) {
                    pos--;
                    return;
                }
        }
        throw new ParseError(`unexpected ${{ [TokenType.NAME]: "name", [TokenType.OPERATOR]: "operator" }[token.t] ?? str(token.t)}`, token.s);
    };
    const parseExpression = (end: string | false, beginParen?: Token, lift = false): AST.Node => {
        const exprItems: (AST.Node | Token)[] = [];
        for (; ;) {
            var tok = nextToken(!!end, beginParen);
            if (!end && tok === undefined) break;
            if (tok!.t === end) break;
            switch (tok!.k) {
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
