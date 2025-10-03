import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/parser";
import { AST, ASTAnnotatedValue, ASTAssignment, ASTBinaryOp, ASTBlock, ASTCall, ASTConditional, ASTConstant, ASTDefaultPlaceholder, ASTDefine, ASTInterpolation, ASTKeywordArg, ASTList, ASTMapping, ASTNameReference, ASTParameterDescriptor, ASTPipePlaceholder, ASTSplatExpression, ASTSymbol, ASTTemplate, ASTUnaryOp } from "../src/parser/ast";
import { LocationTrace, ParseError } from "../src/parser/errors";
import { optreq } from "./com";

const importsNeeded = new Set<string>();

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

function code(o: AST, ...args: string[]): string {
    importsNeeded.add(o.constructor.name);
    return `new ${o.constructor.name}(${location(o.location)}${args.map(arg => ", " + arg).join("")})`;
}

function location(t: LocationTrace): string {
    return `new LocationTrace(${t.line}, ${t.col}, ${internString(t.filename)})`;
}

function liststr(args: string[]): string {
    return `[${args.join(", ")}]`;
}

function list(args: AST[]): string {
    return liststr(args.map(toJS));
}

function prim(arg: string | number | boolean): string {
    if (typeof arg === "string") return internString(arg);
    return JSON.stringify(arg);
}

function toJS(ast: AST): string {
    if (ast instanceof ASTAnnotatedValue)
        return ast.value ? code(ast, list(ast.attributes), toJS(ast.value)) : code(ast, list(ast.attributes));
    if (ast instanceof ASTConstant)
        return code(ast, prim(ast.value));
    if (ast instanceof ASTSymbol)
        return code(ast, prim(ast.value));
    if (ast instanceof ASTNameReference)
        return code(ast, prim(ast.name));
    if (ast instanceof ASTAssignment)
        return code(ast, prim(ast.name), toJS(ast.value));
    if (ast instanceof ASTCall)
        return code(ast, prim(ast.name), list(ast.args));
    if (ast instanceof ASTList)
        return code(ast, list(ast.values));
    if (ast instanceof ASTDefine)
        return code(ast, prim(ast.name), list(ast.parameters), toJS(ast.body));
    if (ast instanceof ASTTemplate)
        return code(ast, toJS(ast.result));
    if (ast instanceof ASTInterpolation)
        return code(ast, toJS(ast.value));
    if (ast instanceof ASTSplatExpression)
        return code(ast, toJS(ast.value));
    if (ast instanceof ASTPipePlaceholder)
        return code(ast);
    if (ast instanceof ASTBinaryOp)
        return code(ast, prim(ast.op), toJS(ast.left), toJS(ast.right), ...(ast.assign ? [prim(ast.noLift), location(ast.assign)] : []));
    if (ast instanceof ASTUnaryOp)
        return code(ast, prim(ast.op), toJS(ast.value));
    if (ast instanceof ASTConditional)
        return code(ast, toJS(ast.cond), toJS(ast.caseTrue), toJS(ast.caseFalse));
    if (ast instanceof ASTDefaultPlaceholder)
        return code(ast);
    if (ast instanceof ASTKeywordArg)
        return code(ast, prim(ast.name), toJS(ast.arg));
    if (ast instanceof ASTBlock)
        return code(ast, list(ast.body));
    if (ast instanceof ASTParameterDescriptor)
        return code(ast, prim(ast.name), toJS(ast.enumOptions), toJS(ast.defaultValue));
    if (ast instanceof ASTMapping)
        return code(ast, liststr(ast.mapping.map(({ key, val }) => `{ key: ${toJS(key)}, val: ${toJS(val)} }`)));
    throw "unreachable";
}

const filename = optreq("-f");
const input = readFileSync(filename, "utf8");
const displayFilename = optreq("-d");
const files = { [displayFilename]: input };
var ast: AST;

try {
    ast = parse(input, displayFilename);
} catch (e) {
    if (!(e instanceof ParseError)) throw e;
    process.stderr.write(e.displayOn(files));
    process.exit(1);
}

const js = toJS(ast);
const pathToSrc = optreq("-p");
process.stdout.write(`import { ${[...importsNeeded].join(", ")} } from ${JSON.stringify("./" + join(pathToSrc, "parser/ast"))};
import { LocationTrace } from ${JSON.stringify("./" + join(pathToSrc, "parser/errors"))};
export const source = /* @__PURE__ */ ${JSON.stringify(input.split("\n"), null, 4)}.join("\\n");
${getInternedStrings()}
const ast = ${js};
export default ast;
`);
process.exit(0);
