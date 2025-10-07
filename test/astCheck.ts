import { expect } from "bun:test";
import { parse } from "../src/compiler";
import { AST } from "../src/compiler/ast";
import { EvalState } from "../src/compiler/evalState";
import { ErrorNote, ParseError, RuntimeError, TinyAError } from "../src/compiler/errors";

export const F = "<test string>";

type Constructor<T> = abstract new (...args: any[]) => T;
interface ASTSpec {
    __class__?: Constructor<AST.Node>;
    [p: string]: Constructor<AST.Node> | string | number | ASTSpec | ASTSpec[] | undefined | null;
}
function checkAST(ast: any, spec: ASTSpec, path: string) {
    for (var prop of Object.keys(spec)) {
        const newpath = path + "." + prop
        const failMsg = "AST failed to match at " + newpath;
        const desc = spec[prop]!;
        if (prop === "__class__") {
            expect(ast, failMsg).toBeInstanceOf(desc);
        } else if (Array.isArray(desc)) {
            expect(ast[prop], failMsg).toBeArrayOfSize(desc.length);
            for (var i = 0; i < desc.length; i++) {
                checkAST(ast[prop][i], desc[i]!, path + "." + prop + "[" + i + "]");
            }
        } else if (typeof desc === "object" && desc !== null) {
            checkAST(ast[prop], desc, newpath);
        } else {
            expect(ast[prop], failMsg).toEqual(desc);
        }
    }
}
export async function expectParse(p: string, spec: ASTSpec) {
    try {
        checkAST(await parse(p, F), spec, "");
    } catch (e) {
        if (e instanceof TinyAError) {
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

export async function expectEval(p: string, state: EvalState, spec: ASTSpec) {
    try {
        checkAST(await parse(p, F).then(e => e.eval(state)), spec, "");
    } catch (e) {
        if (e instanceof TinyAError) {
            expect.unreachable(e.displayOn({ [F]: p }) + e.stack);
        }
        else throw e;
    }
}

export async function expectEvalError(p: string, state: EvalState, error: string, note?: string) {
    try {
        await parse(p, F).then(e => e.eval(state));
        expect.unreachable("Did not throw an error!")
    } catch (e: any) {
        expect(e).toBeInstanceOf(RuntimeError);
        expect(e.message).toEqual(error);
        if (note !== undefined) {
            expect(e.notes.map((n: ErrorNote) => n.message)).toContain(note);
        }
    }
}
