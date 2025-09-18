import { expect } from "bun:test";
import { parse } from "../src/parser";
import { AST } from "../src/parser/ast";
import { ErrorNote, ParseError } from "../src/parser/errors";

const F = "<test string>";

type Constructor<T> = new (...args: any[]) => T;
interface ASTSpec {
    __class__?: Constructor<AST>;
    [p: string]: Constructor<AST> | string | number | ASTSpec | ASTSpec[] | undefined;
}
function checkAST(ast: any, spec: ASTSpec, path: string) {
    const failMsg = "AST failed to match at " + path;
    for (var prop of Object.keys(spec)) {
        const desc = spec[prop]!;
        if (prop === "__class__") {
            expect(ast, failMsg).toBeInstanceOf(desc);
        } else if (Array.isArray(desc)) {
            expect(ast[prop], failMsg).toBeArrayOfSize(desc.length);
            for (var i = 0; i < desc.length; i++) {
                checkAST(ast[prop][i], desc[i]!, path + "." + prop + "[" + i + "]");
            }
        } else if (typeof desc === "object") {
            checkAST(ast[prop], desc, path + "." + prop);
        } else {
            expect(ast[prop], failMsg).toEqual(desc);
        }
    }
}
export function expectAST(p: string, spec: ASTSpec) {
    try {
        checkAST(parse(p, F), spec, "");
    } catch (e) {
        if (e instanceof ParseError) {
            expect.unreachable(e.displayOn({ [F]: p }));
        }
        else throw e;
    }
}
export function expectParseError(p: string, error: string, note?: string) {
    try {
        parse(p, F);
        expect.unreachable("Did not throw an error!");
    } catch (e: any) {
        expect(e).toBeInstanceOf(ParseError);
        expect(e.message).toEqual(error);
        if (note !== undefined) {
            expect(e.notes.map((n: ErrorNote) => n.message)).toContain(note);
        }
    }
}
