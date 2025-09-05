import { AST, ASTBinaryOp, ASTConstant, ASTSymbol, ASTInterpolation, ASTDefine, ASTNodeCall, ASTNameReference, ASTTemplate, ASTList, ASTDefaultPlaceholder } from "./ast";
import { ParseError } from "./errors";
import { treeifyExpression } from "./expression";
import { Token, TokenType } from "./tokenizer";


export function liftCommas(expr: AST): AST[] {
    return expr instanceof ASTBinaryOp && expr.op === "," ? [...liftCommas(expr.left), ...liftCommas(expr.right)] : [expr];
}
export function parseTokens(tokens: Token[]): AST {
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
