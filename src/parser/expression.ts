import { AST, ASTBinaryOp, ASTDefaultPlaceholder, ASTUnaryOp } from "./ast";
import { LocationTrace, ParseError } from "./errors";
import { getPrecedence, isRightAssociative } from "./operator";
import { Token, TokenType } from "./tokenizer";

export function treeifyExpression(tokens: (AST | Token)[], lift: boolean = false): AST {
    var i: number;
    commaAndAssignHack(tokens);
    const firstToken = tokens.find(t => t instanceof Token);
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
                    throw new ParseError("expected a value after operator", token.location);
                }
                if (prevWasAtom) {
                    const precedence = getPrecedence(token, false);
                    if (bestBinaryPrecedence > precedence || (bestBinaryPrecedence === precedence && isRightAssociative(token.text))) {
                        bestBinaryPrecedence = precedence;
                        bestBinaryIndex = i;
                    }
                } else {
                    // possible unary operator to lift
                    if (!(tokens[i + 1]! instanceof AST)) continue; // not innermost unary
                    const mePrecedence = getPrecedence(token, true);
                    const opAfter = tokens[i + 2] as Token | undefined;
                    if (opAfter) {
                        const opAfterPrecedence = getPrecedence(opAfter, false);
                        if (opAfterPrecedence < mePrecedence) continue; // don't lift yet
                    }
                    // we can lift this
                    if (bestUnaryPrecedence > mePrecedence) {
                        bestUnaryPrecedence = mePrecedence;
                        bestUnaryIndex = i;
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
            const math = new ASTBinaryOp(op.location, op.text, left, right, false, op.assign);
            tokens.splice(bestBinaryIndex - 1, 0, math);
        } else {
            throw new ParseError("unknown error in expression parsing", firstToken?.location);
        }
    }
    const result = tokens[0];
    if (lift && result instanceof ASTBinaryOp) result.noLift = true;
    return result as AST;
}

function commaAndAssignHack(tokens: (AST | Token)[]) {
    for (var i = -1; i < tokens.length; i++) {
        const here = tokens[i];
        const next = tokens[i + 1];
        if (commaIsh(here) && commaIsh(next)) {
            // insert default sentinels in between consecutive commas or colons
            tokens.splice(i + 1, 0, new ASTDefaultPlaceholder(next?.location ?? here?.location ?? LocationTrace.nowhere));
        } else if (tokenLike(here) && tokenLike(next) && here.type === TokenType.OPERATOR && next.type === TokenType.OPERATOR && next.text === "=") {
            tokens.splice(i, 2, new Token(here.text, here.location, here.type, next.location));
        } else if (here instanceof AST && next instanceof AST) {
            throw new ParseError("expected operator before value", next.edgemost(false).location);
        }
    }
}

function commaIsh(x: Token | AST | undefined): x is Token | undefined {
    return !x || (x instanceof Token && (x.text === "," || x.text === ":"));
}

function tokenLike(x: Token | AST | undefined) {
    return x instanceof Token;
}
