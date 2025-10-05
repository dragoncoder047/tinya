import { expect } from "bun:test";
import { parse } from "../src/compiler";
import { AST } from "../src/compiler/ast";
import { ErrorNote, ParseError } from "../src/compiler/errors";

const F = "<test string>";

type Constructor<T> = abstract new (...args: any[]) => T;
interface ASTSpec {
    __class__?: Constructor<AST.Node>;
    [p: string]: Constructor<AST.Node> | string | number | ASTSpec | ASTSpec[] | undefined | null;
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
        } else if (typeof desc === "object" && desc !== null) {
            checkAST(ast[prop], desc, path + "." + prop);
        } else {
            expect(ast[prop], failMsg).toEqual(desc);
        }
    }
}
export async function expectAST(p: string, spec: ASTSpec) {
    try {
        checkAST(await parse(p, F), spec, "");
    } catch (e) {
        if (e instanceof ParseError) {
            expect.unreachable(e.displayOn({ [F]: p }) + e.stack);
        }
        else throw e;
    }
}
export async function expectParseError(p: string, error: string, note?: string) {
    try {
        await parse(p, F);
        expect.unreachable("Did not throw an error!");
    } catch (e: any) {
        expect(e).toBeInstanceOf(ParseError);
        expect(e.message).toEqual(error);
        if (note !== undefined) {
            expect(e.notes.map((n: ErrorNote) => n.message)).toContain(note);
        }
    }
}
