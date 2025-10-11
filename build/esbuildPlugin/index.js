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
  LocationTrace,
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
} from "../chunk-7CNEPKY5.js";

// src/esbuildPlugin/include.ts
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
var IncludePlaceholder = class extends Leaf {
  constructor(loc, varname, filename) {
    super(loc);
    this.varname = varname;
    this.filename = filename;
  }
  static {
    __name(this, "IncludePlaceholder");
  }
  exists = true;
};
async function include(entrypoint, outSourceFileMap) {
  const fileToDepsPlaceholderMap = /* @__PURE__ */ new Map();
  const filenameToNodeMap = {};
  const entryPlaceholder = new IncludePlaceholder(LocationTrace.nowhere, null, resolve(entrypoint));
  const toCheck = [entryPlaceholder];
  while (toCheck.length > 0) {
    const cur = toCheck.shift();
    if (fileToDepsPlaceholderMap.has(cur.filename)) continue;
    const deps = await getFile(cur, outSourceFileMap, filenameToNodeMap);
    fileToDepsPlaceholderMap.set(cur.filename, [cur, deps]);
    for (var dep of deps) {
      toCheck.push(dep);
    }
  }
  const orderSet = /* @__PURE__ */ new Set();
  const recurse = /* @__PURE__ */ __name((curFile, stack) => {
    const [curIP, deps] = fileToDepsPlaceholderMap.get(curFile);
    const sm1 = stack.slice(1);
    const errTrace = sm1.map((t) => new ErrorNote("note: included from here:", t.loc));
    if (!curIP.exists) {
      throw new ParseError("no such file " + str(curFile), stack[0].loc, errTrace.slice(0, -1));
    }
    if (sm1.some((t) => t.filename === curFile)) {
      throw new ParseError(errTrace.length > 1 ? "circular #!include" : "file #!include's itself", stack[0].loc, errTrace.slice(0, -1));
    }
    const had = orderSet.delete(curFile);
    orderSet.add(curFile);
    if (had) return;
    for (var dep2 of deps) {
      recurse(dep2.filename, [dep2, ...stack]);
    }
  }, "recurse");
  recurse(entrypoint, [entryPlaceholder]);
  const orderFiles = [...orderSet].reverse();
  const varnameToNodeMap = {};
  const filenameToVarnameMap = {};
  for (var i = 0; i < orderFiles.length; i++) {
    const [p] = fileToDepsPlaceholderMap.get(orderFiles[i]);
    varnameToNodeMap[filenameToVarnameMap[p.filename] = p.varname = "_" + basename(p.filename).toLowerCase().replace(/\.syd$/, "").replace(/\W/g, "") + i] = filenameToNodeMap[p.filename];
  }
  for (var [_, [s, ds]] of fileToDepsPlaceholderMap.entries()) {
    s.varname = filenameToVarnameMap[s.filename];
    for (var d of ds) {
      d.varname = filenameToVarnameMap[d.filename];
    }
  }
  return {
    order: orderFiles.map((f) => filenameToVarnameMap[f]),
    map: varnameToNodeMap,
    watchFiles: [...fileToDepsPlaceholderMap.keys()]
  };
}
__name(include, "include");
async function getFile(where, sourceMap, nodeMap) {
  const deps = [];
  const walk = /* @__PURE__ */ __name(async (ast) => {
    if (!isinstance(ast, AnnotatedValue) || !isinstance(ast.value, Value) || typeof ast.value.value !== "string" || ast.attributes.length !== 1 || !isinstance(ast.attributes[0], Name) || ast.attributes[0].name !== "include") return ast.pipe(walk);
    const p = new IncludePlaceholder(ast.value.loc, null, resolve(dirname(where.filename), ast.value.value));
    deps.push(p);
    return p;
  }, "walk");
  try {
    nodeMap[where.filename] = await walk(await parseFile(where.filename, sourceMap));
  } catch (e) {
    if (e.code === "ENOENT") {
      where.exists = false;
    } else {
      throw e;
    }
  }
  return deps;
}
__name(getFile, "getFile");
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
  throw "unreachable! " + ast;
}
__name(toJS, "toJS");
async function toJSFile(filename) {
  var order, map, watchFiles;
  const files = {};
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
  const js = order.map((m) => `const ${m} = ${toJS(map[m])}`).join("\n\n");
  return {
    src: `import { ${[...neededNames.values()].join(", ")} } from "syd";

export const sources = /* @__PURE__ */ {
    ${Object.entries(files).map(([name, source]) => `${str(name)}:
${indent(str(source.split("\n"), null, 4))}.join("\\n")`).join(",\n    ")}
};

${getInternedStrings()}

${js}

export const ast = ${order.at(-1)};

export default ast;
`,
    watchFiles
  };
}
__name(toJSFile, "toJSFile");

// src/esbuildPlugin/index.ts
function sydPlugin() {
  return {
    name: "syd",
    setup(build) {
      build.onLoad({ filter: /\.syd$/ }, async (args) => {
        const { src, watchFiles } = await toJSFile(args.path);
        return {
          contents: src,
          watchFiles,
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
