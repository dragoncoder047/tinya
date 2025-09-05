import { AST, ASTAssignment, ASTBinaryOp, ASTDefaultPlaceholder, ASTNameReference, ASTUnaryOp } from "./ast";
import { LocationTrace, ParseError } from "./errors";
import { getPrecedence, getPrecedenceSloppy, isRightAssociative } from "./operators";
import { Token, TokenType } from "./tokenizer";

export function treeifyExpression(tokens: (AST | Token)[], lastToken: Token | undefined): AST {
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
                tokens.splice(bestBinaryIndex - 1, 0);
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
