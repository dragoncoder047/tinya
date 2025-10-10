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
    const cache = new Map<string, string>();
    await doInclude(entrypoint, filemap, outSourceFileMap, includeCounter, includeOrder, cache, []);
    return [includeOrder, filemap];
}
var spaces = 0, indent = () => "|  ".repeat(spaces).trimEnd();
async function doInclude(curFile: string, filemap: Record<string, AST.Node>, sourceMap: Record<string, string>, includeCounter: { value: number }, includeOrder: string[], cache: Map<string, string>, includeStack: [string, AST.Value][]) {
    const filename = curFile;
    var currentFileNameVar = "_" + basename(filename).replace(/\W/g, "").toLowerCase() + includeCounter.value++;
    const walk = async (ast: AST.Node): Promise<AST.Node> => {
        if (
            !isinstance(ast, AST.AnnotatedValue) ||
            !isinstance(ast.value, AST.Value) ||
            typeof ast.value.value !== "string" ||
            ast.attributes.length !== 1 ||
            !isinstance(ast.attributes[0], AST.Name) ||
            ast.attributes[0]!.name !== "include"
        ) return ast.pipe(walk);
        console.log(indent(), "from", filename, "got include for", ast.value.value);
        const f = resolve(dirname(filename), ast.value.value);
        if (includeStack.some(v => v[0] === f)) {
            throw new ParseError("circular #!include", ast.value.loc, includeStack.map(v => new ErrorNote("note: included from here:", v[1].loc)));
        }
        try {
            const theVarname = await doInclude(f, filemap, sourceMap, includeCounter, includeOrder, cache, [[f, ast.value], ...includeStack]);
            console.log(indent(), "finished include of", ast.value.value);
            return new IncludePlaceholder(ast.loc, theVarname);
        } catch (e: any) {
            if (e.code === "ENOENT") {
                throw new ParseError("no such file " + str(f), ast.value.loc, includeStack.map(v => new ErrorNote("note: included from here:", v[1].loc)));
            }
            throw e;
        }
    }
    spaces++;
    if (!cache.has(filename)) {
        console.log(indent(), "including", filename, "as", currentFileNameVar);
        filemap[currentFileNameVar] = await walk(await parseFile(filename, sourceMap));
        if (cache.has(filename)) throw new Error("something is wrong...", );
        cache.set(filename, currentFileNameVar);
        console.log(indent(), "finished including", filename, cache);
    } else {
        currentFileNameVar = cache.get(filename)!;
        console.log(indent(), "using cached version for", currentFileNameVar);
    }
    spaces--;
    if (includeOrder.includes(currentFileNameVar)) {
        includeOrder.splice(includeOrder.indexOf(currentFileNameVar), 1);
    }
    includeOrder.unshift(currentFileNameVar);
    return currentFileNameVar;
}

async function parseFile(filename: string, filemap: Record<string, string>): Promise<AST.Node> {
    return await parse(filemap[basename(filename)] = readFileSync(filename, "utf8"), basename(filename));
}
