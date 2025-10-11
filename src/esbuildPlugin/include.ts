import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parse } from "../compiler";
import * as AST from "../compiler/ast";
import { ErrorNote, LocationTrace, ParseError } from "../compiler/errors";
import { isinstance, str } from "../utils";

export class IncludePlaceholder extends AST.Leaf {
    exists = true;
    constructor(loc: LocationTrace, public varname: string | null, public filename: string) { super(loc); }
}
export async function include(entrypoint: string, outSourceFileMap: Record<string, string>): Promise<{
    order: string[],
    watchFiles: string[],
    map: Record<string, AST.Node>
}> {
    // first recursively check all of the files and find their dependencies
    const fileToDepsPlaceholderMap = new Map<string, [IncludePlaceholder, IncludePlaceholder[]]>();
    const filenameToNodeMap: Record<string, AST.Node> = {};
    const entryPlaceholder = new IncludePlaceholder(LocationTrace.nowhere, null, resolve(entrypoint));
    const toCheck = [entryPlaceholder];
    while (toCheck.length > 0) {
        const cur = toCheck.shift()!;
        if (fileToDepsPlaceholderMap.has(cur.filename)) continue;
        const deps = await getFile(cur, outSourceFileMap, filenameToNodeMap);
        fileToDepsPlaceholderMap.set(cur.filename, [cur, deps]);
        for (var dep of deps) {
            toCheck.push(dep);
        }
    }
    // Dumb Toposort / checking for circular includes and stuff
    const orderSet = new Set<string>();
    const recurse = (curFile: string, stack: IncludePlaceholder[]) => {
        const [curIP, deps] = fileToDepsPlaceholderMap.get(curFile)!;
        const sm1 = stack.slice(1);
        const errTrace = sm1.map(t => new ErrorNote("note: included from here:", t.loc));
        // check if file exists
        if (!curIP.exists) {
            throw new ParseError("no such file " + str(curFile), stack[0]!.loc, errTrace.slice(0, -1));
        }
        // check if circular deps
        if (sm1.some(t => t.filename === curFile)) {
            throw new ParseError(errTrace.length > 1 ? "circular #!include" : "file #!include's itself", stack[0]!.loc, errTrace.slice(0, -1));
        }
        // move to front
        const had = orderSet.delete(curFile);
        orderSet.add(curFile);
        if (had) return;
        // recurse on dependencies
        for (var dep of deps) {
            recurse(dep.filename, [dep, ...stack]);
        }
    }
    recurse(entrypoint, [entryPlaceholder]);
    const orderFiles = [...orderSet].reverse();
    const varnameToNodeMap: Record<string, AST.Node> = {};
    const filenameToVarnameMap: Record<string, string> = {};
    for (var i = 0; i < orderFiles.length; i++) {
        const [p] = fileToDepsPlaceholderMap.get(orderFiles[i]!)!;
        varnameToNodeMap[filenameToVarnameMap[p.filename] = p.varname = "_" + basename(p.filename).toLowerCase().replace(/\.syd$/, "").replace(/\W/g, "") + i] = filenameToNodeMap[p.filename]!;
    }
    // copy to others
    for (var [_, [s, ds]] of fileToDepsPlaceholderMap.entries()) {
        s.varname = filenameToVarnameMap[s.filename]!;
        for (var d of ds) {
            d.varname = filenameToVarnameMap[d.filename]!;
        }
    }
    return {
        order: orderFiles.map(f => filenameToVarnameMap[f]!), map: varnameToNodeMap,
        watchFiles: [...fileToDepsPlaceholderMap.keys()],
    };
}
async function getFile(where: IncludePlaceholder, sourceMap: Record<string, string>, nodeMap: Record<string, AST.Node>): Promise<IncludePlaceholder[]> {
    const deps: IncludePlaceholder[] = [];
    const walk = async (ast: AST.Node): Promise<AST.Node> => {
        if (
            !isinstance(ast, AST.AnnotatedValue) ||
            !isinstance(ast.value, AST.Value) ||
            typeof ast.value.value !== "string" ||
            ast.attributes.length !== 1 ||
            !isinstance(ast.attributes[0], AST.Name) ||
            ast.attributes[0]!.name !== "include"
        ) return ast.pipe(walk);
        const p = new IncludePlaceholder(ast.value.loc, null, resolve(dirname(where.filename), ast.value.value));
        deps.push(p);
        return p;
    }
    try {
        nodeMap[where.filename] = await walk(await parseFile(where.filename, sourceMap));
    } catch (e: any) {
        if (e.code === "ENOENT") {
            where.exists = false;
        }
        else {
            throw e;
        }
    }
    return deps;
}

async function parseFile(filename: string, filemap: Record<string, string>): Promise<AST.Node> {
    return await parse(filemap[basename(filename)] = readFileSync(filename, "utf8"), basename(filename));
}
