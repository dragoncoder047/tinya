import {
  AnnotatedValue,
  Assignment,
  BinaryOp,
  Block,
  Call,
  Conditional,
  DefaultPlaceholder,
  Definition,
  InterpolatedValue,
  KeywordArgument,
  List,
  Mapping,
  Name,
  ParameterDescriptor,
  PipePlaceholder,
  SplatValue,
  Symbol,
  Template,
  UnaryOp,
  Value,
  parse
} from "../chunk-G32GKSBF.js";
import {
  ParseError,
  __name,
  isinstance,
  str
} from "../chunk-PAJYDYBO.js";

// src/esbuildPlugin/index.ts
import { basename } from "node:path";

// src/esbuildPlugin/tojs.ts
import { readFileSync } from "node:fs";
var internedStrings = /* @__PURE__ */ new Map();
var internStringCounter = 0;
function internString(s) {
  if (!internedStrings.has(s)) {
    internedStrings.set(s, "_str" + internStringCounter++ + s.toLowerCase().replaceAll(/[^\w]/g, ""));
  }
  return internedStrings.get(s);
}
__name(internString, "internString");
function getInternedStrings() {
  return `const ${indent([...internedStrings].map(([val, name]) => `
${name} = ${str(val)}`).join(", "))};`;
}
__name(getInternedStrings, "getInternedStrings");
function indent(string) {
  return string ? string.split("\n").map((l) => "    " + l).join("\n") : "";
}
__name(indent, "indent");
var neededNames = /* @__PURE__ */ new Set();
function code(name, o, ...args) {
  neededNames.add(name);
  return `new ${name}(${location(o.loc)}${args.length > 0 ? ",\n" : ""}${indent(args.join(",\n"))})`;
}
__name(code, "code");
function location(t) {
  return `new LocationTrace(${t.line}, ${t.col}, ${internString(t.file)})`;
}
__name(location, "location");
function liststr(args) {
  return `[${args.length > 0 ? "\n" : ""}${indent(args.join(",\n"))}]`;
}
__name(liststr, "liststr");
function list(args) {
  return liststr(args.map(toJS));
}
__name(list, "list");
function prim(arg) {
  if (typeof arg === "string") return internString(arg);
  return str(arg);
}
__name(prim, "prim");
function toJS(ast) {
  if (isinstance(ast, AnnotatedValue))
    return ast.value ? code("AnnotatedValue", ast, list(ast.attributes), toJS(ast.value)) : code("AnnotatedValue", ast, list(ast.attributes));
  if (isinstance(ast, Value))
    return code("Value", ast, prim(ast.value));
  if (isinstance(ast, Symbol))
    return code("Symbol", ast, prim(ast.value));
  if (isinstance(ast, Name))
    return code("Name", ast, prim(ast.name));
  if (isinstance(ast, Assignment))
    return code("Assignment", ast, toJS(ast.target), toJS(ast.value));
  if (isinstance(ast, Call))
    return code("Call", ast, prim(ast.name), list(ast.args));
  if (isinstance(ast, List))
    return code("List", ast, list(ast.values));
  if (isinstance(ast, Definition))
    return code("Definition", ast, prim(ast.name), prim(ast.outMacro), list(ast.parameters), toJS(ast.body));
  if (isinstance(ast, Template))
    return code("Template", ast, toJS(ast.result));
  if (isinstance(ast, InterpolatedValue))
    return code("InterpolatedValue", ast, toJS(ast.value));
  if (isinstance(ast, SplatValue))
    return code("SplatValue", ast, toJS(ast.value));
  if (isinstance(ast, PipePlaceholder))
    return code("PipePlaceholder", ast);
  if (isinstance(ast, BinaryOp))
    return code("BinaryOp", ast, prim(ast.op), toJS(ast.left), toJS(ast.right), ...ast.assign ? [prim(ast.noLift), location(ast.assign)] : []);
  if (isinstance(ast, UnaryOp))
    return code("UnaryOp", ast, prim(ast.op), toJS(ast.value));
  if (isinstance(ast, Conditional))
    return code("Conditional", ast, toJS(ast.cond), toJS(ast.caseTrue), toJS(ast.caseFalse));
  if (isinstance(ast, DefaultPlaceholder))
    return code("DefaultPlaceholder", ast);
  if (isinstance(ast, KeywordArgument))
    return code("KeywordArgument", ast, prim(ast.name), toJS(ast.arg));
  if (isinstance(ast, Block))
    return code("Block", ast, list(ast.body));
  if (isinstance(ast, ParameterDescriptor))
    return code("ParameterDescriptor", ast, prim(ast.name), toJS(ast.enumOptions), toJS(ast.defaultValue), prim(ast.lazy));
  if (isinstance(ast, Mapping))
    return code("Mapping", ast, liststr(ast.mapping.map(({ key, val }) => `{ key: ${toJS(key)}, val: ${toJS(val)} }`)));
  throw "unreachable";
}
__name(toJS, "toJS");
async function toJSFile(filename, displayFilename) {
  const input = readFileSync(filename, "utf8");
  const files = { [displayFilename]: input };
  var ast;
  try {
    ast = await parse(input, displayFilename);
  } catch (e) {
    if (!isinstance(e, ParseError)) throw e;
    console.error(e.displayOn(files));
    throw e;
  }
  internStringCounter = 0;
  internedStrings.clear();
  neededNames.clear();
  const js = toJS(ast);
  neededNames.add("LocationTrace");
  return `import { ${[...neededNames.values()].join(", ")} } from "syd";

export const source = /* @__PURE__ */ ${str(input.split("\n"), null, 4)}.join("\\n");

${getInternedStrings()}

export const ast = ${js};

export default ast;
`;
}
__name(toJSFile, "toJSFile");

// src/esbuildPlugin/index.ts
function sydPlugin() {
  return {
    name: "syd",
    setup(build) {
      build.onLoad({ filter: /\.syd$/ }, async (args) => {
        return {
          contents: await toJSFile(args.path, basename(args.path)),
          loader: "js"
        };
      });
    }
  };
}
__name(sydPlugin, "sydPlugin");
export {
  sydPlugin
};
//# sourceMappingURL=index.js.map
