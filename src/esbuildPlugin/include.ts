import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parse } from "../compiler";
import * as AST from "../compiler/ast";
import { ErrorNote, LocationTrace, ParseError } from "../compiler/errors";
import { isinstance, str } from "../utils";

export class IncludePlaceholder extends AST.Leaf {
    constructor(loc: LocationTrace, public varname: string) { super(loc); }
}
export async function processIncludes(entrypoint: string, outSourceFileMap: Record<string, string>): Promise<[string[], Record<string, AST.Node>]> {
    const includeOrder: string[] = [];
    const includeCounter = { value: 0 };
    const filemap = {};
    const seenFiles = new Set<string>();
    await doInclude(entrypoint, filemap, outSourceFileMap, includeCounter, includeOrder, seenFiles, []);
    return [includeOrder, filemap];
}

async function doInclude(filename: string, filemap: Record<string, AST.Node>, sourceMap: Record<string, string>, includeCounter: { value: number }, includeOrder: string[], seenFiles: Set<string>, includeStack: AST.Value[]) {
    const currentFileNameVar = "_" + basename(filename).replace(/\W/g, "").toLowerCase() + "_" + includeCounter.value++;
    const walk = async (ast: AST.Node): Promise<AST.Node> => {
        if (
            !isinstance(ast, AST.AnnotatedValue) ||
            !isinstance(ast.value, AST.Value) ||
            typeof ast.value.value !== "string" ||
            ast.attributes.length !== 1 ||
            !isinstance(ast.attributes[0], AST.Name) ||
            ast.attributes[0]!.name !== "include"
        ) return ast.pipe(walk);
        const f = resolve(dirname(filename), ast.value.value);
        if (seenFiles.has(f)) {
            throw new ParseError("circular import", ast.value.loc, includeStack.map(v => new ErrorNote("note: included from here:", v.loc)));
        }
        try {
            await doInclude(f, filemap, sourceMap, includeCounter, includeOrder, seenFiles, [...includeStack, ast.value]);
        } catch (e: any) {
            if (e.code === "ENOENT") {
                throw new ParseError("no such file " + str(f), ast.value.loc, includeStack.map(v => new ErrorNote("note: included from here:", v.loc)));
            }
            throw e;
        }
        return new IncludePlaceholder(ast.loc, currentFileNameVar);
    }
    seenFiles.add(filename);
    includeOrder.unshift(currentFileNameVar);
    filemap[currentFileNameVar] = await walk(await parseFile(filename, sourceMap));
}

async function parseFile(filename: string, filemap: Record<string, string>): Promise<AST.Node> {
    return await parse(filemap[basename(filename)] = readFileSync(filename, "utf8"), basename(filename));
}
