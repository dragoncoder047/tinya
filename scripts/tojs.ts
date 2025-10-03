import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/compiler";
import { AST } from "../src/compiler/ast";
import { LocationTrace, ParseError } from "../src/compiler/errors";
import { optreq } from "./com";

const internedStrings = new Map<string, string>();
var internStringCounter = 0;
function internString(s: string): string {
    if (!internedStrings.has(s)) {
        internedStrings.set(s, "_str" + (internStringCounter++) + s.toLowerCase().replaceAll(/[^\w]/g, ""));
    }
    return internedStrings.get(s)!;
}

function getInternedStrings(): string {
    return `const ${[...internedStrings].map(([val, name]) => `${name} = ${JSON.stringify(val)}`).join(", ")};`;
}

function code(o: AST.Node, ...args: string[]): string {
    return `new AST.${o.constructor.name}(${location(o.loc)}${args.map(arg => ", " + arg).join("")})`;
}

function location(t: LocationTrace): string {
    return `new LocationTrace(${t.line}, ${t.col}, ${internString(t.filename)})`;
}

function liststr(args: string[]): string {
    return `[${args.join(", ")}]`;
}

function list(args: AST.Node[]): string {
    return liststr(args.map(toJS));
}

function prim(arg: string | number | boolean): string {
    if (typeof arg === "string") return internString(arg);
    return JSON.stringify(arg);
}

function toJS(ast: AST.Node): string {
    if (ast instanceof AST.AnnotatedValue)
        return ast.value ? code(ast, list(ast.attributes), toJS(ast.value)) : code(ast, list(ast.attributes));
    if (ast instanceof AST.Constant)
        return code(ast, prim(ast.value));
    if (ast instanceof AST.Symbol)
        return code(ast, prim(ast.value));
    if (ast instanceof AST.Name)
        return code(ast, prim(ast.name));
    if (ast instanceof AST.Assignment)
        return code(ast, prim(ast.name), toJS(ast.value));
    if (ast instanceof AST.Call)
        return code(ast, prim(ast.name), list(ast.args));
    if (ast instanceof AST.List)
        return code(ast, list(ast.values));
    if (ast instanceof AST.Definition)
        return code(ast, prim(ast.name), list(ast.parameters), toJS(ast.body));
    if (ast instanceof AST.Template)
        return code(ast, toJS(ast.result));
    if (ast instanceof AST.InterpolatedValue)
        return code(ast, toJS(ast.value));
    if (ast instanceof AST.SplatValue)
        return code(ast, toJS(ast.value));
    if (ast instanceof AST.PipePlaceholder)
        return code(ast);
    if (ast instanceof AST.BinaryOp)
        return code(ast, prim(ast.op), toJS(ast.left), toJS(ast.right), ...(ast.assign ? [prim(ast.noLift), location(ast.assign)] : []));
    if (ast instanceof AST.UnaryOp)
        return code(ast, prim(ast.op), toJS(ast.value));
    if (ast instanceof AST.Conditional)
        return code(ast, toJS(ast.cond), toJS(ast.caseTrue), toJS(ast.caseFalse));
    if (ast instanceof AST.DefaultPlaceholder)
        return code(ast);
    if (ast instanceof AST.KeywordArgument)
        return code(ast, prim(ast.name), toJS(ast.arg));
    if (ast instanceof AST.Block)
        return code(ast, list(ast.body));
    if (ast instanceof AST.ParameterDescriptor)
        return code(ast, prim(ast.name), toJS(ast.enumOptions), toJS(ast.defaultValue));
    if (ast instanceof AST.Mapping)
        return code(ast, liststr(ast.mapping.map(({ key, val }) => `{ key: ${toJS(key)}, val: ${toJS(val)} }`)));
    throw "unreachable";
}

const filename = optreq("-f");
const input = readFileSync(filename, "utf8");
const displayFilename = optreq("-d");
const files = { [displayFilename]: input };
var ast: AST.Node;

try {
    ast = parse(input, displayFilename);
} catch (e) {
    if (!(e instanceof ParseError)) throw e;
    process.stderr.write(e.displayOn(files));
    process.exit(1);
}

const js = toJS(ast);
const pathToSrc = optreq("-p");
process.stdout.write(`import { AST } from ${JSON.stringify("./" + join(pathToSrc, "compiler/ast"))};
import { LocationTrace } from ${JSON.stringify("./" + join(pathToSrc, "compiler/errors"))};
export const source = /* @__PURE__ */ ${JSON.stringify(input.split("\n"), null, 4)}.join("\\n");
${getInternedStrings()}
const ast = ${js};
export default ast;
`);
process.exit(0);
