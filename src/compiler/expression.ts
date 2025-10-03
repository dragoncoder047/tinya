import { AST } from "./ast";
import { LocationTrace, ParseError } from "./errors";
import { getPrecedence, isRightAssociative } from "./operator";
import { Token, TokenType } from "./tokenizer";

export function treeifyExpression(tokens: (AST.Node | Token)[], lift: boolean = false): AST.Node {
    var i: number;
    attributesHack(tokens);
    pipePlaceholdersHack(tokens);
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
        const lastAtomIndex = tokens.findLastIndex(e => e instanceof AST.Node);
        for (i = 0; i < tokens.length; i++) {
            const token = tokens[i]!;
            if (token instanceof AST.Node) prevWasAtom = true;
            else {
                if (i > lastAtomIndex) {
                    throw new ParseError("expected a value after operator", token.s);
                }
                if (prevWasAtom) {
                    const precedence = getPrecedence(token, false);
                    if (bestBinaryPrecedence > precedence || (bestBinaryPrecedence === precedence && isRightAssociative(token.t))) {
                        bestBinaryPrecedence = precedence;
                        bestBinaryIndex = i;
                    }
                } else {
                    // possible unary operator to lift
                    if (!(tokens[i + 1]! instanceof AST.Node)) continue; // not innermost unary
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
            const [op, val] = tokens.splice(bestUnaryIndex, 2) as [Token, AST.Node];
            tokens.splice(bestUnaryIndex, 0, new AST.UnaryOp(op.s, op.t, val));
        } else if (bestBinaryIndex >= 0) {
            const [left, op, right] = tokens.splice(bestBinaryIndex - 1, 3) as [AST.Node, Token, AST.Node];
            const math = new AST.BinaryOp(op.s, op.t, left, right, false, op.a);
            tokens.splice(bestBinaryIndex - 1, 0, math);
        } else {
            throw new ParseError("unknown error in expression parsing", firstToken?.s);
        }
    }
    const result = tokens[0];
    if (lift && result instanceof AST.BinaryOp) result.noLift = true;
    return result as AST.Node;
}

function attributesHack(tokens: (AST.Node | Token)[]) {
    var attrs: AST.Node[] = [];
    for (var i = 0; i < tokens.length; i++) {
        const here = tokens[i]!;
        if (here instanceof Token) {
            if (here.t === "#!") {
                const value = tokens.splice(i, 2)[1];
                if (!(value instanceof AST.Name || value instanceof AST.Call)) {
                    throw new ParseError("expected attribute after '#!'", here.s);
                }
                attrs.push(value);
                i--;
            } else if (attrs.length > 0) {
                tokens.splice(i, 0, new AST.AnnotatedValue(here.s, attrs, null))
                attrs = [];
            }
        } else if (attrs.length > 0) {
            tokens[i] = new AST.AnnotatedValue(here.loc, attrs, here);
            attrs = [];
        }
    }
    if (attrs.length > 0) {
        tokens.push(new AST.AnnotatedValue(attrs.at(-1)!.loc, attrs, null));
    }
}

function pipePlaceholdersHack(tokens: (AST.Node | Token)[]) {
    for (var i = 0; i < tokens.length; i++) {
        const before = tokens[i - 1];
        const here = tokens[i];
        const after = tokens[i + 1];
        if (here instanceof Token && here.t === "#" && !(before instanceof AST.Node || after instanceof AST.Node)) {
            tokens[i] = new AST.PipePlaceholder(here.s);
        }
    }
}

function commaAndAssignHack(tokens: (AST.Node | Token)[]) {
    for (var i = -1; i < tokens.length; i++) {
        const here = tokens[i];
        const next = tokens[i + 1];
        if (commaIsh(here) && commaIsh(next)) {
            // insert default sentinels in between consecutive commas or colons
            tokens.splice(i + 1, 0, new AST.DefaultPlaceholder(next?.s ?? here?.s ?? LocationTrace.nowhere));
        } else if (tokenLike(here) && tokenLike(next) && here.k === TokenType.OPERATOR && next.k === TokenType.OPERATOR && next.t === "=") {
            tokens.splice(i, 2, new Token(here.t, here.s, here.k, next.s));
        } else if (here instanceof AST.Node && next instanceof AST.Node) {
            throw new ParseError("expected operator before value", next.edgemost(false).loc);
        }
    }
}

function commaIsh(x: Token | AST.Node | undefined): x is Token | undefined {
    return !x || (x instanceof Token && /^[,:;]$/.test(x.t));
}

function tokenLike(x: Token | AST.Node | undefined) {
    return x instanceof Token;
}
