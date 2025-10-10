import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parse } from "../compiler";
import * as AST from "../compiler/ast";
import { LocationTrace, ParseError } from "../compiler/errors";
import { isinstance, str } from "../utils";
import { IncludePlaceholder, include } from "./include";

const internedStrings = new Map<string, string>();
var internStringCounter = 0;
export function internString(s: string): string {
    if (!internedStrings.has(s)) {
        internedStrings.set(s, "_str" + (internStringCounter++) + s.toLowerCase().replaceAll(/\W/g, ""));
    }
    return internedStrings.get(s)!;
}

function getInternedStrings(): string {
    return `const ${indent([...internedStrings].map(([val, name]) => `\n${name} = ${str(val)}`).join(", "))};`;
}

function indent(string: string): string {
    return string ? string.split("\n").map(l => "    " + l).join("\n") : "";
}

const neededNames = new Set<string>();
function code(name: string, o: AST.Node, ...args: string[]): string {
    neededNames.add(name);
    return `new ${name}(${location(o.loc)}${args.length > 0 ? ",\n" : ""}${indent(args.join(",\n"))})`;
}

function location(t: LocationTrace): string {
    return `new LocationTrace(${t.line}, ${t.col}, ${internString(t.file)})`;
}

function liststr(args: string[]): string {
    return `[${args.length > 0 ? "\n" : ""}${indent(args.join(",\n"))}]`;
}

function list(args: AST.Node[]): string {
    return liststr(args.map(toJS));
}

function prim(arg: string | number | boolean): string {
    if (typeof arg === "string") return internString(arg);
    return str(arg);
}

function toJS(ast: AST.Node): string {
    if (isinstance(ast, AST.AnnotatedValue))
        return ast.value ? code("AnnotatedValue", ast, list(ast.attributes), toJS(ast.value)) : code("AnnotatedValue", ast, list(ast.attributes));
    if (isinstance(ast, AST.Value))
        return code("Value", ast, prim(ast.value));
    if (isinstance(ast, AST.Symbol))
        return code("Symbol", ast, prim(ast.value));
    if (isinstance(ast, AST.Name))
        return code("Name", ast, prim(ast.name));
    if (isinstance(ast, AST.Assignment))
        return code("Assignment", ast, toJS(ast.target), toJS(ast.value));
    if (isinstance(ast, AST.Call))
        return code("Call", ast, prim(ast.name), list(ast.args));
    if (isinstance(ast, AST.List))
        return code("List", ast, list(ast.values));
    if (isinstance(ast, AST.Definition))
        return code("Definition", ast, prim(ast.name), prim(ast.outMacro), list(ast.parameters), toJS(ast.body));
    if (isinstance(ast, AST.Template))
        return code("Template", ast, toJS(ast.result));
    if (isinstance(ast, AST.InterpolatedValue))
        return code("InterpolatedValue", ast, toJS(ast.value));
    if (isinstance(ast, AST.SplatValue))
        return code("SplatValue", ast, toJS(ast.value));
    if (isinstance(ast, AST.PipePlaceholder))
        return code("PipePlaceholder", ast);
    if (isinstance(ast, AST.BinaryOp))
        return code("BinaryOp", ast, prim(ast.op), toJS(ast.left), toJS(ast.right), ...(ast.assign ? [prim(ast.noLift), location(ast.assign)] : []));
    if (isinstance(ast, AST.UnaryOp))
        return code("UnaryOp", ast, prim(ast.op), toJS(ast.value));
    if (isinstance(ast, AST.Conditional))
        return code("Conditional", ast, toJS(ast.cond), toJS(ast.caseTrue), toJS(ast.caseFalse));
    if (isinstance(ast, AST.DefaultPlaceholder))
        return code("DefaultPlaceholder", ast);
    if (isinstance(ast, AST.KeywordArgument))
        return code("KeywordArgument", ast, prim(ast.name), toJS(ast.arg));
    if (isinstance(ast, AST.Block))
        return code("Block", ast, list(ast.body));
    if (isinstance(ast, AST.ParameterDescriptor))
        return code("ParameterDescriptor", ast, prim(ast.name), toJS(ast.enumOptions), toJS(ast.defaultValue), prim(ast.lazy));
    if (isinstance(ast, AST.Mapping))
        return code("Mapping", ast, liststr(ast.mapping.map(({ key, val }) => `{ key: ${toJS(key)}, val: ${toJS(val)} }`)));
    if (isinstance(ast, IncludePlaceholder))
        return ast.varname!;
    throw "unreachable! " + ast;
}

export async function toJSFile(filename: string): Promise<{ src: string, watchFiles: string[] }> {
    var order: string[], map: Record<string, AST.Node>, watchFiles: string[];
    const files: Record<string, string> = {};
    try {
        const res = await include(filename, files);
        order = res.order;
        map = res.map;
        watchFiles = res.watchFiles;
    } catch (e) {
        if (!isinstance(e, ParseError)) throw e;
        console.error(e.displayOn(files));
        throw e;
    }
    internStringCounter = 0;
    internedStrings.clear();
    neededNames.clear();
    neededNames.add("LocationTrace");
    const js = order.map(m => `const ${m} = ${toJS(map[m]!)}`).join("\n\n");
    return {
        src: `import { ${[...neededNames.values()].join(", ")} } from "syd";

export const sources = /* @__PURE__ */ {
    ${Object.entries(files).map(([name, source]) => str(name) + ":\n" + indent(str(source.split("\n"), null, 4))).join(",\n    ")}
};

${getInternedStrings()}

${js}

export const ast = ${order.at(-1)};

export default ast;
`, watchFiles
    };
}
