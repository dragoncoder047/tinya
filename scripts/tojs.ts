import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/compiler";
import { AST } from "../src/compiler/ast";
import { LocationTrace, ParseError } from "../src/compiler/errors";
import { optreq } from "./com";
import { isinstance } from "../src/utils";

const internedStrings = new Map<string, string>();
var internStringCounter = 0;
function internString(s: string): string {
    if (!internedStrings.has(s)) {
        internedStrings.set(s, "_str" + (internStringCounter++) + s.toLowerCase().replaceAll(/[^\w]/g, ""));
    }
    return internedStrings.get(s)!;
}

function getInternedStrings(): string {
    return `const ${indent([...internedStrings].map(([val, name]) => `\n${name} = ${JSON.stringify(val)}`).join(", "))};`;
}

function indent(string: string): string {
    return string ? string.split("\n").map(l => "    " + l).join("\n") : "";
}

function code(o: AST.Node, ...args: string[]): string {
    return `new AST.${o.constructor.name}(${location(o.loc)}${args.length > 0 ? ",\n" : ""}${indent(args.join(",\n"))})`;
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
    return JSON.stringify(arg);
}

function toJS(ast: AST.Node): string {
    if (isinstance(ast, AST.AnnotatedValue))
        return ast.value ? code(ast, list(ast.attributes), toJS(ast.value)) : code(ast, list(ast.attributes));
    if (isinstance(ast, AST.Value))
        return code(ast, prim(ast.value));
    if (isinstance(ast, AST.Symbol))
        return code(ast, prim(ast.value));
    if (isinstance(ast, AST.Name))
        return code(ast, prim(ast.name));
    if (isinstance(ast, AST.Assignment))
        return code(ast, prim(ast.name), toJS(ast.value));
    if (isinstance(ast, AST.Call))
        return code(ast, prim(ast.name), list(ast.args));
    if (isinstance(ast, AST.List))
        return code(ast, list(ast.values));
    if (isinstance(ast, AST.Definition))
        return code(ast, prim(ast.name), prim(ast.outMacro), list(ast.parameters), toJS(ast.body));
    if (isinstance(ast, AST.Template))
        return code(ast, toJS(ast.result));
    if (isinstance(ast, AST.InterpolatedValue))
        return code(ast, toJS(ast.value));
    if (isinstance(ast, AST.SplatValue))
        return code(ast, toJS(ast.value));
    if (isinstance(ast, AST.PipePlaceholder))
        return code(ast);
    if (isinstance(ast, AST.BinaryOp))
        return code(ast, prim(ast.op), toJS(ast.left), toJS(ast.right), ...(ast.assign ? [prim(ast.noLift), location(ast.assign)] : []));
    if (isinstance(ast, AST.UnaryOp))
        return code(ast, prim(ast.op), toJS(ast.value));
    if (isinstance(ast, AST.Conditional))
        return code(ast, toJS(ast.cond), toJS(ast.caseTrue), toJS(ast.caseFalse));
    if (isinstance(ast, AST.DefaultPlaceholder))
        return code(ast);
    if (isinstance(ast, AST.KeywordArgument))
        return code(ast, prim(ast.name), toJS(ast.arg));
    if (isinstance(ast, AST.Block))
        return code(ast, list(ast.body));
    if (isinstance(ast, AST.ParameterDescriptor))
        return code(ast, prim(ast.name), toJS(ast.enumOptions), toJS(ast.defaultValue), prim(ast.lazy));
    if (isinstance(ast, AST.Mapping))
        return code(ast, liststr(ast.mapping.map(({ key, val }) => `{ key: ${toJS(key)}, val: ${toJS(val)} }`)));
    throw "unreachable";
}

const filename = optreq("-f");
const input = readFileSync(filename, "utf8");
const displayFilename = optreq("-d");
const files = { [displayFilename]: input };
var ast: AST.Node;

try {
    ast = await parse(input, displayFilename);
} catch (e) {
    if (!isinstance(e, ParseError)) throw e;
    process.stderr.write(e.displayOn(files));
    process.exit(1);
}

const js = toJS(ast);
const pathToSrc = optreq("-p");
process.stdout.write(`import { AST } from ${JSON.stringify("./" + join(pathToSrc, "compiler/ast"))};
import { LocationTrace } from ${JSON.stringify("./" + join(pathToSrc, "compiler/errors"))};

export const source = /* @__PURE__ */ ${JSON.stringify(input.split("\n"), null, 4)}.join("\\n");

${getInternedStrings()}

export const ast = ${js};

export default ast;
`);
process.exit(0);
