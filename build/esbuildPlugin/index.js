import {
  AnnotatedValue,
  Assignment,
  BinaryOp,
  Block,
  Call,
  Conditional,
  DefaultPlaceholder,
  Definition,
  ErrorNote,
  InterpolatedValue,
  KeywordArgument,
  Leaf,
  List,
  Mapping,
  Name,
  ParameterDescriptor,
  ParseError,
  PipePlaceholder,
  SplatValue,
  Symbol,
  Template,
  UnaryOp,
  Value,
  __name,
  isinstance,
  parse,
  str
} from "../chunk-YGXSPSEX.js";

// src/esbuildPlugin/include.ts
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
var IncludePlaceholder = class extends Leaf {
  constructor(loc, varname) {
    super(loc);
    this.varname = varname;
  }
  static {
    __name(this, "IncludePlaceholder");
  }
};
async function processIncludes(entrypoint, outSourceFileMap) {
  const includeOrder = [];
  const includeCounter = { value: 0 };
  const filemap = {};
  const seenFiles = /* @__PURE__ */ new Set();
  await doInclude(entrypoint, filemap, outSourceFileMap, includeCounter, includeOrder, seenFiles, []);
  return [includeOrder, filemap];
}
__name(processIncludes, "processIncludes");
async function doInclude(filename, filemap, sourceMap, includeCounter, includeOrder, seenFiles, includeStack) {
  const currentFileNameVar = "_" + basename(filename).replace(/\W/g, "").toLowerCase() + "_" + includeCounter.value++;
  const walk = /* @__PURE__ */ __name(async (ast) => {
    if (!isinstance(ast, AnnotatedValue) || !isinstance(ast.value, Value) || typeof ast.value.value !== "string" || ast.attributes.length !== 1 || !isinstance(ast.attributes[0], Name) || ast.attributes[0].name !== "include") return ast.pipe(walk);
    const f = resolve(dirname(filename), ast.value.value);
    if (seenFiles.has(f)) {
      throw new ParseError("circular import", ast.value.loc, includeStack.map((v) => new ErrorNote("note: included from here:", v.loc)));
    }
    try {
      await doInclude(f, filemap, sourceMap, includeCounter, includeOrder, seenFiles, [...includeStack, ast.value]);
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new ParseError("no such file " + str(f), ast.value.loc, includeStack.map((v) => new ErrorNote("note: included from here:", v.loc)));
      }
      throw e;
    }
    return new IncludePlaceholder(ast.loc, currentFileNameVar);
  }, "walk");
  seenFiles.add(filename);
  includeOrder.unshift(currentFileNameVar);
  filemap[currentFileNameVar] = await walk(await parseFile(filename, sourceMap));
}
__name(doInclude, "doInclude");
async function parseFile(filename, filemap) {
  return await parse(filemap[basename(filename)] = readFileSync(filename, "utf8"), basename(filename));
}
__name(parseFile, "parseFile");

// src/esbuildPlugin/tojs.ts
var internedStrings = /* @__PURE__ */ new Map();
var internStringCounter = 0;
function internString(s) {
  if (!internedStrings.has(s)) {
    internedStrings.set(s, "_str" + internStringCounter++ + s.toLowerCase().replaceAll(/\W/g, ""));
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
  if (isinstance(ast, IncludePlaceholder))
    return ast.varname;
  throw "unreachable";
}
__name(toJS, "toJS");
async function toJSFile(filename) {
  var includeOrder, modules;
  const files = {};
  try {
    [includeOrder, modules] = await processIncludes(filename, files);
  } catch (e) {
    if (!isinstance(e, ParseError)) throw e;
    console.error(e.displayOn(files));
    throw e;
  }
  internStringCounter = 0;
  internedStrings.clear();
  neededNames.clear();
  neededNames.add("LocationTrace");
  const js = includeOrder.map((m) => `const ${m} = ${toJS(modules[m])}`).join("\n\n");
  return `import { ${[...neededNames.values()].join(", ")} } from "syd";

export const sources = /* @__PURE__ */ {
    ${Object.entries(files).map(([name, source]) => str(name) + ":\n" + indent(str(source.split("\n"), null, 4))).join(",\n    ")}
};

${getInternedStrings()}

${js}

export const ast = ${includeOrder.at(-1)};

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
          contents: await toJSFile(args.path),
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
