var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/compiler/errors.ts
var LocationTrace = class _LocationTrace {
  constructor(line, col, file, source = null) {
    this.line = line;
    this.col = col;
    this.file = file;
    this.source = source;
  }
  static {
    __name(this, "LocationTrace");
  }
  static nowhere = new _LocationTrace(0, 0, "unknown");
};
function formatTrace(trace, message, sources) {
  const src = sources[trace.file];
  var lineInfo = "";
  if (src) {
    const lines = src.split("\n");
    const relevantLine = lines[trace.line] || "";
    const lineNumberString = trace.line + 1 + "";
    lineInfo = `
${lineNumberString} | ${relevantLine}
${" ".repeat(lineNumberString.length)} | ${" ".repeat(trace.col)}^`;
  }
  return `${trace.file}:${trace.line + 1}:${trace.col + 1}: ${message}${lineInfo}${trace.source ? "\n" + formatTrace(trace.source[1], trace.source[0], sources) : ""}`;
}
__name(formatTrace, "formatTrace");
var ErrorNote = class {
  constructor(message, location) {
    this.message = message;
    this.location = location;
  }
  static {
    __name(this, "ErrorNote");
  }
};
var SydError = class extends Error {
  constructor(message, trace = LocationTrace.nowhere, notes = []) {
    super(message);
    this.trace = trace;
    this.notes = notes;
  }
  static {
    __name(this, "SydError");
  }
  displayOn(sources) {
    return formatTrace(this.trace, "error: " + this.message, sources) + this.notes.map((note) => "\n" + formatTrace(note.location, note.message, sources)).join("") + "\n";
  }
};
var ParseError = class extends SydError {
  static {
    __name(this, "ParseError");
  }
};
var RuntimeError = class extends SydError {
  static {
    __name(this, "RuntimeError");
  }
};
var CompileError = class extends SydError {
  static {
    __name(this, "CompileError");
  }
};

// src/utils.ts
var typeOf = /* @__PURE__ */ __name((x) => typeof x, "typeOf");
var is = /* @__PURE__ */ __name((t, func = typeOf) => (x) => func(x) === t, "is");
var isNumber = is("number");
var isArray = Array.isArray;
var str = JSON.stringify;
function isinstance(obj, cls) {
  return obj instanceof cls;
}
__name(isinstance, "isinstance");
var idMap = /* @__PURE__ */ new WeakMap();
var idCounter = 0;
var id = /* @__PURE__ */ __name((obj) => {
  if (!idMap.has(obj)) idMap.set(obj, idCounter++);
  return idMap.get(obj);
}, "id");

// src/compiler/ast.ts
var ast_exports = {};
__export(ast_exports, {
  AnnotatedValue: () => AnnotatedValue,
  Assignment: () => Assignment,
  BinaryOp: () => BinaryOp,
  Block: () => Block,
  Call: () => Call,
  Conditional: () => Conditional,
  DefaultPlaceholder: () => DefaultPlaceholder,
  Definition: () => Definition,
  InterpolatedValue: () => InterpolatedValue,
  KeywordArgument: () => KeywordArgument,
  LateBinding: () => LateBinding,
  Leaf: () => Leaf,
  List: () => List,
  Mapping: () => Mapping,
  Name: () => Name,
  Node: () => Node,
  NotCodeNode: () => NotCodeNode,
  ParameterDescriptor: () => ParameterDescriptor,
  PipePlaceholder: () => PipePlaceholder,
  SplatValue: () => SplatValue,
  Symbol: () => Symbol2,
  Template: () => Template,
  UnaryOp: () => UnaryOp,
  Value: () => Value,
  stackToNotes: () => stackToNotes
});

// src/compiler/call.ts
async function processArgsInCall(state, doEvalArgs, site, args, nodeImpl) {
  const newArgs = nodeImpl[1].map((arg) => arg[1] !== null ? new Value(site, arg[1]) : null);
  const seenArgs = newArgs.map((_) => null);
  var firstKW;
  for (var i = 0; i < args.length; i++) {
    const arg = args[i];
    var argIndex = i;
    if (isinstance(arg, KeywordArgument)) {
      if (!firstKW) firstKW = arg;
      argIndex = nodeImpl[1].findIndex((a) => a[0] === arg.name);
      if (argIndex === -1) {
        throw new RuntimeError(`no such keyword argument ${str(arg.name)} on node ${nodeImpl[0]}`, arg.loc, stackToNotes(state.callstack));
      }
    } else {
      if (firstKW) throw new RuntimeError("positional argument can't come after keyword argument", arg.loc, [new ErrorNote("note: first keyword argument was here:", firstKW.loc), ...stackToNotes(state.callstack)]);
      if (i >= nodeImpl[1].length) throw new RuntimeError("too many arguments to " + nodeImpl[0], arg.edgemost(true).loc, stackToNotes(state.callstack));
    }
    const argEntry = nodeImpl[1][argIndex];
    if (seenArgs[argIndex]) {
      throw new RuntimeError(`argument ${str(argEntry[0])} already provided`, arg.loc, [new ErrorNote("note: first occurrance was here:", seenArgs[argIndex].edgemost(true).loc), ...stackToNotes(state.callstack)]);
    }
    seenArgs[argIndex] = arg;
    const defaultValue = argEntry[1];
    const enumChoices = nodeImpl[3][argIndex] ?? null;
    const walkAndReplaceSymbols = /* @__PURE__ */ __name(async (ast) => {
      if (isinstance(ast, Call)) return ast;
      if (isinstance(ast, Symbol2)) {
        var value2 = enumChoices?.[ast.value];
        if ((value2 ?? void 0) === void 0) {
          throw new RuntimeError(enumChoices ? `unknown symbol name ${str(ast.value)} for parameter` : "symbol constant not valid here", ast.loc, enumChoices ? [new ErrorNote("note: valid options are: " + Object.keys(enumChoices).join(", "), ast.loc)] : []);
        }
        if (!isinstance(value2, Value)) {
          value2 = new Value(ast.loc, value2);
        }
        return value2;
      }
      return ast.pipe(walkAndReplaceSymbols);
    }, "walkAndReplaceSymbols");
    var value = await walkAndReplaceSymbols(isinstance(arg, KeywordArgument) ? arg.arg : arg);
    if (isinstance(arg, DefaultPlaceholder)) {
      if ((defaultValue ?? null) === null) {
        throw new RuntimeError(`missing value for argument ${argEntry[0]}`, arg.loc, stackToNotes(state.callstack));
      }
      value = new Value(arg.loc, defaultValue);
    } else if (isinstance(arg, SplatValue)) {
      throw new RuntimeError("splats are only valid in a list", arg.loc, stackToNotes(state.callstack));
    } else if (doEvalArgs) {
      value = await value.eval(state);
      if (value.hasNodes) throw new RuntimeError("cannot use value dependent on audio node output in compile-time calculation", value.loc);
    }
    newArgs[argIndex] = value;
  }
  for (var i = 0; i < nodeImpl[1].length; i++) {
    if (newArgs[i] === null) {
      const argEntry = nodeImpl[1][i];
      throw new RuntimeError(`missing value for argument ${argEntry[0]}`, site, stackToNotes(state.callstack));
    }
  }
  return newArgs;
}
__name(processArgsInCall, "processArgsInCall");

// src/compiler/evalState.ts
function pushNamed(defs, newDef) {
  const i = defs.findIndex((d) => d[0] === newDef[0]);
  if (i !== -1) defs[i] = newDef;
  else defs.push(newDef);
}
__name(pushNamed, "pushNamed");

// src/compiler/codemacro.ts
function makeCodeMacroExpander(name, finalMacro, params, body) {
  const fakeNodeDef = [name, [], 0 /* NORMAL_OR_MONO */, [], null];
  const shouldEvalParam = [];
  var built = false;
  async function build(state) {
    await validate(state);
    built = true;
    for (var i = 0; i < params.length; i++) {
      var param = params[i];
      if (isinstance(param, Name)) {
        fakeNodeDef[1].push([param.name, null]);
        fakeNodeDef[3].push(void 0);
        shouldEvalParam.push(true);
      } else if (isinstance(param, ParameterDescriptor)) {
        var v = param.defaultValue;
        if (isinstance(v, DefaultPlaceholder)) v = null;
        fakeNodeDef[1].push([param.name, v]);
        fakeNodeDef[3].push(await param.enumOptions.toJS(state));
        shouldEvalParam.push(!param.lazy);
      } else throw new RuntimeError("unreachable", param.loc, stackToNotes(state.callstack));
    }
  }
  __name(build, "build");
  async function validate(state) {
  }
  __name(validate, "validate");
  const f = /* @__PURE__ */ __name(async (args, state) => {
    if (!built) await build(state);
    if (state.callstack.length > state.recursionLimit) throw new RuntimeError("too much recursion", state.callstack.at(-1).loc, stackToNotes(state.callstack));
    const givenArgs = await processArgsInCall(state, false, state.callstack.at(-1).loc, args, fakeNodeDef);
    const newState = { ...state, env: Object.create(state.globalEnv) };
    for (var i = 0; i < fakeNodeDef[1].length; i++) {
      const param = givenArgs[i];
      newState.env[fakeNodeDef[1][i][0]] = shouldEvalParam[i] ? await param.eval(state) : param;
    }
    const result = await body.eval(newState);
    return finalMacro ? result.eval(state) : result;
  }, "f");
  f.body = body;
  return f;
}
__name(makeCodeMacroExpander, "makeCodeMacroExpander");

// src/math.ts
var PI = Math.PI;
var TAU = 2 * PI;
var min = Math.min;
var max = Math.max;
var clamp = /* @__PURE__ */ __name((x, y, z) => max(min(x, z), y), "clamp");
var sin = Math.sin;
var cos = Math.cos;
var sgn = Math.sign;
var abs = Math.abs;
var tan = /* @__PURE__ */ __name((x) => clamp(Math.tan(x), -1, 1), "tan");
var saw = /* @__PURE__ */ __name((x) => 1 - (2 * x / TAU % 2 + 2) % 2, "saw");
var tri = /* @__PURE__ */ __name((x) => 1 - 4 * abs(Math.round(x / TAU) - x / TAU), "tri");
var noise3 = /* @__PURE__ */ __name((x) => sin(x ** 3), "noise3");
var noise5 = /* @__PURE__ */ __name((x) => sin(x ** 5), "noise5");
var matMul = /* @__PURE__ */ __name((a, b) => {
  var aNumRows = a.length, aNumCols = a[0].length, bNumCols = b[0].length, m = [];
  for (var r = 0; r < aNumRows; r++) {
    m[r] = [];
    for (var c = 0; c < bNumCols; c++) {
      m[r][c] = 0;
      for (var i = 0; i < aNumCols; i++) {
        m[r][c] += a[r][i] * b[i][c];
      }
    }
  }
  return m;
}, "matMul");

// src/compiler/operator.ts
var INVALID = -1;
var Operator = class {
  constructor(b, u = INVALID, r = false) {
    this.b = b;
    this.u = u;
    this.r = r;
  }
  static {
    __name(this, "Operator");
  }
  cb = null;
  cu = null;
  code(b, u = null) {
    this.cb = b;
    this.cu = u;
    return this;
  }
};
var op = /* @__PURE__ */ __name((b, u, r) => new Operator(b, u, r), "op");
var OPERATORS = {
  // attribute sigil
  "#!": op(INVALID, -Infinity),
  // symbol name
  ".": op(INVALID, -Infinity),
  // interpolate and bitwise AND
  "&": op(6, 0).code((a, b) => a & b),
  // length or as 0-ary pipeline placeholder (that is handled specially)
  "#": op(INVALID, 0).code(null, (a) => a.length),
  // boolean NOT
  "!": op(INVALID, 0).code(null, (a) => !a),
  // power
  "**": op(1, INVALID, true).code((a, b) => a ** b),
  // multiply or splat operator
  "*": op(3, -Infinity).code((a, b) => a * b),
  // divide & modulo
  "/": op(3).code((a, b) => a / b),
  "%": op(3).code((a, b) => a % b),
  // matrix multiply
  // or decorator to mark param or declaration as lazy/macro
  "@": op(3, -Infinity).code(matMul),
  // add
  "+": op(4).code((a, b) => a + b),
  // subtract, negate
  "-": op(4, 2).code((a, b) => a - b, (a) => -a),
  // boolean OR / AND
  "||": op(5).code((a, b) => a || b),
  "&&": op(5).code((a, b) => a && b),
  // bit shifting (before other bitwise to match C)
  ">>": op(5.9).code((a, b) => a >> b),
  "<<": op(5.9).code((a, b) => a << b),
  // bitwise OR / XOR
  "|": op(6).code((a, b) => a | b),
  "^": op(6).code((a, b) => a ^ b),
  // comparison
  "==": op(7).code((a, b) => a == b),
  ">=": op(7).code((a, b) => a >= b),
  ">": op(7).code((a, b) => a > b),
  "<=": op(7).code((a, b) => a <= b),
  "<": op(7).code((a, b) => a < b),
  "!=": op(7).code((a, b) => a != b),
  // pipe
  "|>": op(8),
  // conditional in 2 parts (treated as binary and postprocessed for simplicity)
  // colon is also used for keyword arguments
  ":": op(9, INVALID, true),
  "?": op(10, INVALID, true),
  // assignment operator (no overloads and handles specially, just here so it can be parsed in the right spot)
  "=": op(11),
  // mapping operator (for inside lists)
  "=>": op(12),
  // define operator (handled specially)
  ":-": op(12),
  // statement separator
  ",": op(13).code((_, b) => b),
  ";": op(13)
};
var OP_REGEX = new RegExp(`^(${Object.keys(OPERATORS).sort((a, b) => b.length - a.length).map((e) => e.replaceAll(/([()[\]{}*+?|^$\\.])/g, "\\$1")).join("|")})`);
function getPrecedence(token, unary) {
  return OPERATORS[token][unary ? "u" : "b"] ?? INVALID;
}
__name(getPrecedence, "getPrecedence");
function getPrecedenceAndCheckValidity(token, isUnary) {
  const keyOperator = token.a ? "=" : token.t;
  const realOperator = token.t + (token.a ? "=" : "");
  const mePrecedence = getPrecedence(keyOperator, isUnary);
  if (mePrecedence === INVALID) {
    throw new ParseError(`${str(realOperator)} is not valid as a ${["binary", "unary"][+isUnary]} operator`, token.s);
  }
  return mePrecedence;
}
__name(getPrecedenceAndCheckValidity, "getPrecedenceAndCheckValidity");
function isRightAssociative(token) {
  return OPERATORS[token].r;
}
__name(isRightAssociative, "isRightAssociative");

// src/compiler/prog.ts
var Opcode = /* @__PURE__ */ ((Opcode2) => {
  Opcode2[Opcode2["NOOP"] = 0] = "NOOP";
  Opcode2[Opcode2["PUSH_CONSTANT"] = 1] = "PUSH_CONSTANT";
  Opcode2[Opcode2["PUSH_INPUT_SAMPLES"] = 2] = "PUSH_INPUT_SAMPLES";
  Opcode2[Opcode2["PUSH_PITCH"] = 3] = "PUSH_PITCH";
  Opcode2[Opcode2["PUSH_EXPRESSION"] = 4] = "PUSH_EXPRESSION";
  Opcode2[Opcode2["PUSH_GATE"] = 5] = "PUSH_GATE";
  Opcode2[Opcode2["MARK_STILL_ALIVE"] = 6] = "MARK_STILL_ALIVE";
  Opcode2[Opcode2["PUSH_FRESH_EMPTY_LIST"] = 7] = "PUSH_FRESH_EMPTY_LIST";
  Opcode2[Opcode2["APPEND_TO_LIST"] = 8] = "APPEND_TO_LIST";
  Opcode2[Opcode2["EXTEND_TO_LIST"] = 9] = "EXTEND_TO_LIST";
  Opcode2[Opcode2["DO_BINARY_OP"] = 10] = "DO_BINARY_OP";
  Opcode2[Opcode2["DO_BINARY_OP_STEREO"] = 11] = "DO_BINARY_OP_STEREO";
  Opcode2[Opcode2["DO_UNARY_OP"] = 12] = "DO_UNARY_OP";
  Opcode2[Opcode2["DO_UNARY_OP_STEREO"] = 13] = "DO_UNARY_OP_STEREO";
  Opcode2[Opcode2["GET_REGISTER"] = 14] = "GET_REGISTER";
  Opcode2[Opcode2["TAP_REGISTER"] = 15] = "TAP_REGISTER";
  Opcode2[Opcode2["SHIFT_REGISTER"] = 16] = "SHIFT_REGISTER";
  Opcode2[Opcode2["CONDITIONAL_SELECT"] = 17] = "CONDITIONAL_SELECT";
  Opcode2[Opcode2["STEREO_DOUBLE_WIDEN"] = 18] = "STEREO_DOUBLE_WIDEN";
  Opcode2[Opcode2["APPLY_NODE"] = 19] = "APPLY_NODE";
  Opcode2[Opcode2["APPLY_DOUBLE_NODE_STEREO"] = 20] = "APPLY_DOUBLE_NODE_STEREO";
  Opcode2[Opcode2["GET_MOD"] = 21] = "GET_MOD";
  return Opcode2;
})(Opcode || {});
function allocRegister(name, state) {
  const i = state.r.indexOf(name);
  if (i === -1) return state.r.push(name) - 1;
  return i;
}
__name(allocRegister, "allocRegister");
function allocNode(name, state) {
  return state.nn.push(name) - 1;
}
__name(allocNode, "allocNode");

// src/compiler/ast.ts
var Node = class {
  constructor(loc) {
    this.loc = loc;
    this.id = id(this);
  }
  static {
    __name(this, "Node");
  }
  id;
};
var NotCodeNode = class extends Node {
  static {
    __name(this, "NotCodeNode");
  }
  compile(state, refMap, ni) {
    throw new CompileError("how did we get here ?!? (" + this.constructor.name + ")", this.loc);
  }
};
var Leaf = class extends NotCodeNode {
  static {
    __name(this, "Leaf");
  }
  edgemost() {
    return this;
  }
  async pipe() {
    return this;
  }
  async eval(_) {
    return this;
  }
};
var AnnotatedValue = class _AnnotatedValue extends NotCodeNode {
  constructor(trace, attributes, value = null) {
    super(trace);
    this.attributes = attributes;
    this.value = value;
  }
  static {
    __name(this, "AnnotatedValue");
  }
  async pipe(fn) {
    return new _AnnotatedValue(this.loc, await asyncNodePipe(this.attributes, fn), this.value ? await fn(this.value) : null);
  }
  edgemost(left) {
    return left ? this.attributes.length > 0 ? this.attributes[0].edgemost(left) : this : this.value ?? this;
  }
  async eval(state) {
    var v = this.value;
    for (var attr of this.attributes) {
      var args = null;
      var name;
      if (isinstance(attr, Call) || isinstance(attr, Name)) {
        name = attr.name;
        const impl = state.annotators[name];
        if (!impl) {
          throw new RuntimeError("unknown annotation " + str(name), attr.loc, stackToNotes(state.callstack));
        }
        if (isinstance(attr, Call)) {
          args = attr.args;
        }
        v = await impl(v, args, state);
      } else {
        throw new RuntimeError("illegal annotation", attr.loc, stackToNotes(state.callstack));
      }
    }
    return v;
  }
};
var Value = class extends Leaf {
  constructor(trace, value) {
    super(trace);
    this.value = value;
  }
  static {
    __name(this, "Value");
  }
  async eval(state) {
    if (isinstance(this.value, Node)) return this.value;
    return this;
  }
  compile(state) {
    state.p.push([1 /* PUSH_CONSTANT */, this.value]);
    state.tosStereo = false;
  }
};
var Symbol2 = class extends Leaf {
  constructor(trace, value) {
    super(trace);
    this.value = value;
  }
  static {
    __name(this, "Symbol");
  }
  async eval(state) {
    return this;
  }
};
var Assignment = class _Assignment extends Node {
  constructor(trace, target, value) {
    super(trace);
    this.target = target;
    this.value = value;
  }
  static {
    __name(this, "Assignment");
  }
  edgemost(left) {
    return left ? this.target.edgemost(left) : this.value.edgemost(left);
  }
  async pipe(fn) {
    return new _Assignment(this.loc, await fn(this.target), await fn(this.value));
  }
  async eval(state) {
    if (!isinstance(this.target, Name)) {
      throw new RuntimeError("cannot assign to this", this.target.loc);
    }
    const name = this.target.name;
    const scope = scopeForName(name, state);
    var b = scope[name];
    if (!b) {
      b = new LateBinding(this.loc, name);
      scope[name] = b;
    }
    const result = scope[name] = await this.value.eval(state);
    if (isinstance(b, LateBinding)) {
      b.boundValue = result;
    }
    return result;
  }
  compile(state, refMap, ni) {
    compileNode(this.value, state, refMap, ni);
    state.p.push([15 /* TAP_REGISTER */, allocRegister(this.target.name, state)]);
  }
};
var Name = class extends Leaf {
  constructor(trace, name) {
    super(trace);
    this.name = name;
  }
  static {
    __name(this, "Name");
  }
  async eval(state) {
    const val = state.env[this.name];
    if (!val) {
      return scopeForName(this.name, state)[this.name] = new LateBinding(this.loc, this.name);
    }
    return val;
  }
  compile(state, refMap, ni) {
    state.p.push([14 /* GET_REGISTER */, allocRegister(this.name, state)]);
  }
};
var LateBinding = class extends Name {
  static {
    __name(this, "LateBinding");
  }
  boundValue = void 0;
  async eval() {
    return this.boundValue ?? this;
  }
  compile(state, refMap, ni) {
    if (!this.boundValue) {
      throw new CompileError(`${this.name} was never assigned to in this scope`, this.loc);
    }
    compileNode(this.boundValue, state, refMap, ni);
    const myRegname = "" + id(this.boundValue);
    const last = state.p.at(-1);
    if (!(last[0] === 14 /* GET_REGISTER */ && state.r[last[1]] === myRegname)) {
      state.p.push([16 /* SHIFT_REGISTER */, allocRegister(myRegname, state)]);
    }
  }
};
var Call = class _Call extends Node {
  constructor(trace, name, args) {
    super(trace);
    this.name = name;
    this.args = args;
  }
  static {
    __name(this, "Call");
  }
  edgemost(left) {
    return left ? this : this.args.at(-1)?.edgemost(left) ?? this;
  }
  async pipe(fn) {
    return new _Call(this.loc, this.name, await asyncNodePipe(this.args, fn));
  }
  async eval(state) {
    const funcImpl = state.functions.find((f) => f[0] === this.name);
    if (funcImpl) {
      const impl = funcImpl[2];
      const newState = { ...state, callstack: state.callstack.concat(this) };
      return impl(this.args, newState);
    }
    const nodeImpl = state.nodes.find((n) => n[0] === this.name);
    if (!nodeImpl) {
      throw new RuntimeError("undefined node or function " + this.name, this.loc, stackToNotes(state.callstack));
    }
    var x;
    if (nodeImpl[2] === 2 /* DECOUPLED_MATH */ && (x = new List(this.loc, this.args)).isImmediate()) {
      return new Value(this.loc, nodeImpl[4](null)(null, x.toImmediate()));
    }
    return new _Call(this.loc, nodeImpl[0], await processArgsInCall(state, true, this.loc, this.args, nodeImpl));
  }
  compile(state, refMap, ni) {
    var i;
    const nodeImpl = ni.find((n) => n[0] === this.name);
    if (!nodeImpl) {
      throw new CompileError(`cannot find node ${this.name} (should be unreachable!!)`, this.loc);
    }
    const argProgs = [];
    const existingProg = state.p;
    for (i = 0; i < this.args.length; i++) {
      state.p = [];
      compileNode(this.args[i], state, refMap, ni);
      argProgs.push([state.p, state.tosStereo ? 1 /* STEREO */ : 0 /* NORMAL_OR_MONO */]);
    }
    state.p = existingProg;
    const callProg = [19 /* APPLY_NODE */, allocNode(this.name, state), nodeImpl[1].length];
    state.tosStereo = nodeImpl[2] === 1 /* STEREO */;
    if (nodeImpl[1].every((a) => a[2] !== 1 /* STEREO */) && argProgs.some((s) => s[1] === 1 /* STEREO */)) {
      for (i = 0; i < nodeImpl[1].length; i++) {
        const gottenArgType = argProgs[i][1];
        if (gottenArgType !== 1 /* STEREO */) {
          makeStereoAtIndex(argProgs[i][0]);
        }
      }
      state.tosStereo = true;
      callProg[0] = 20 /* APPLY_DOUBLE_NODE_STEREO */;
      callProg.splice(2, 0, allocNode(this.name, state));
    } else {
      for (i = 0; i < nodeImpl[1].length; i++) {
        const neededArgType = nodeImpl[1][i][2] ?? 0 /* NORMAL_OR_MONO */;
        const gottenArgType = argProgs[i][1];
        if (neededArgType !== 1 /* STEREO */ && gottenArgType === 1 /* STEREO */) {
          throw new CompileError("cannot implicitly convert stereo output to mono", this.args[i].loc);
        } else if (neededArgType === 1 /* STEREO */ && gottenArgType !== 1 /* STEREO */) {
          makeStereoAtIndex(argProgs[i][0]);
        }
      }
      state.tosStereo = nodeImpl[2] === 1 /* STEREO */;
    }
    for (i = 0; i < this.args.length; i++) {
      state.p.push(...argProgs[i][0]);
    }
    state.p.push(callProg);
  }
};
var List = class _List extends Node {
  constructor(trace, values) {
    super(trace);
    this.values = values;
  }
  static {
    __name(this, "List");
  }
  edgemost(left) {
    return this.values.length > 0 ? left ? this.values[0].edgemost(left) : this.values.at(-1).edgemost(left) : this;
  }
  async pipe(fn) {
    return new _List(this.loc, await asyncNodePipe(this.values, fn));
  }
  async eval(state) {
    const values = [];
    for (var v of this.values) {
      const v2 = await v.eval(state);
      if (isinstance(v2, SplatValue) && isinstance(v2.value, _List)) {
        values.push(...v2.value.values);
      } else {
        values.push(v2);
      }
    }
    return new _List(this.loc, values);
  }
  hasSplats() {
    return this.values.some((v) => isinstance(v, SplatValue));
  }
  isImmediate() {
    return this.values.every((v) => isinstance(v, Value) || isinstance(v, _List) && v.isImmediate());
  }
  toImmediate() {
    if (this.isImmediate()) {
      return this.values.map((v) => isinstance(v, Value) ? v.value : v.toImmediate());
    }
  }
  static fromImmediate(trace, m) {
    return Array.isArray(m) ? new _List(trace, m.map((r) => _List.fromImmediate(trace, r))) : new Value(trace, m);
  }
  compile(state, refMap, ni) {
    if (this.isImmediate()) {
      const imm = this.toImmediate();
      state.p.push([1 /* PUSH_CONSTANT */, imm]);
    } else {
      state.p.push([7 /* PUSH_FRESH_EMPTY_LIST */]);
      for (var arg of this.values) {
        compileNode(arg, state, refMap, ni);
        if (isinstance(arg, SplatValue)) {
          state.p.push([9 /* EXTEND_TO_LIST */]);
        } else {
          state.p.push([8 /* APPEND_TO_LIST */]);
        }
      }
    }
    state.tosStereo = this.values.length === 2;
  }
};
var Definition = class _Definition extends NotCodeNode {
  constructor(trace, name, outMacro, parameters, body) {
    super(trace);
    this.name = name;
    this.outMacro = outMacro;
    this.parameters = parameters;
    this.body = body;
  }
  static {
    __name(this, "Definition");
  }
  edgemost(left) {
    return left ? this.parameters.length > 0 ? this.parameters[0].edgemost(left) : this : this.body.edgemost(left);
  }
  async pipe(fn) {
    return new _Definition(this.loc, this.name, this.outMacro, await asyncNodePipe(this.parameters, fn), await fn(this.body));
  }
  async eval(state) {
    pushNamed(state.functions, [this.name, this.parameters.length, makeCodeMacroExpander(this.name, this.outMacro, this.parameters, this.body)]);
    return new Value(this.loc, void 0);
  }
};
var ParameterDescriptor = class _ParameterDescriptor extends NotCodeNode {
  constructor(trace, name, enumOptions, defaultValue, lazy) {
    super(trace);
    this.name = name;
    this.enumOptions = enumOptions;
    this.defaultValue = defaultValue;
    this.lazy = lazy;
  }
  static {
    __name(this, "ParameterDescriptor");
  }
  edgemost(left) {
    return left ? this : this.defaultValue.edgemost(left);
  }
  async pipe(fn) {
    return new _ParameterDescriptor(this.loc, this.name, await fn(this.enumOptions), await fn(this.defaultValue), this.lazy);
  }
  async eval(state) {
    throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
  }
};
var Template = class _Template extends NotCodeNode {
  constructor(trace, result) {
    super(trace);
    this.result = result;
  }
  static {
    __name(this, "Template");
  }
  edgemost(left) {
    return this.result.edgemost(left);
  }
  async pipe(fn) {
    return new _Template(this.loc, await fn(this.result));
  }
  async eval(state) {
    const replaceTrace = /* @__PURE__ */ __name(async (arg) => {
      const val = await arg.pipe(replaceTrace);
      val.loc = new LocationTrace(arg.loc.line, arg.loc.col, arg.loc.file, ["note: expanded from template:", this.loc]);
      return val;
    }, "replaceTrace");
    const recur = /* @__PURE__ */ __name(async (arg, depth) => {
      if (isinstance(arg, _Template)) return arg.pipe((n) => recur(n, depth + 1));
      if (isinstance(arg, InterpolatedValue)) {
        if (depth <= 1) {
          return replaceTrace(await arg.value.eval(state));
        } else {
          const val = await arg.pipe((n) => recur(n, depth - 1));
          if (isinstance(val, InterpolatedValue) && isinstance(val.value, Value)) return val.value;
          return val;
        }
      }
      return arg.pipe((n) => recur(n, depth));
    }, "recur");
    return recur(await replaceTrace(this.result), 1);
  }
};
var BinaryOp = class _BinaryOp extends Node {
  constructor(trace, op2, left, right, noLift = false, assign) {
    super(trace);
    this.op = op2;
    this.left = left;
    this.right = right;
    this.noLift = noLift;
    this.assign = assign;
  }
  static {
    __name(this, "BinaryOp");
  }
  edgemost(left) {
    return this[left ? "left" : "right"].edgemost(left);
  }
  async pipe(fn) {
    return new _BinaryOp(this.loc, this.op, await fn(this.left), await fn(this.right), this.noLift, this.assign);
  }
  async eval(state) {
    return this._applied(await this.left.eval(state), await this.right.eval(state));
  }
  _applied(left, right) {
    var fn;
    var imm = true, a, b;
    if (isinstance(left, Value)) {
      a = left.value;
    } else if (isinstance(left, List) && left.isImmediate()) {
      a = left.toImmediate();
    } else {
      imm = false;
    }
    if (isinstance(right, Value)) {
      b = right.value;
    } else if (isinstance(right, List) && right.isImmediate()) {
      b = right.toImmediate();
    } else {
      imm = false;
    }
    if ((fn = OPERATORS[this.op]?.cb) && imm) {
      return List.fromImmediate(this.loc, fn(a, b));
    }
    if (isinstance(left, Symbol2) && isinstance(right, Symbol2) && /^[!=]=$/.test(this.op)) {
      return List.fromImmediate(this.loc, fn(left.value, b.value));
    }
    return new _BinaryOp(this.loc, this.op, left, right);
  }
  compile(state, refMap, ni) {
    compileNode(this.left, state, refMap, ni);
    const aStereo = state.tosStereo;
    const aIndex = state.p.length;
    compileNode(this.right, state, refMap, ni);
    const bStereo = state.tosStereo;
    if (state.tosStereo ||= aStereo) {
      if (!aStereo) makeStereoAtIndex(state.p, aIndex);
      if (!bStereo) makeStereoAtIndex(state.p);
    }
    state.p.push([state.tosStereo ? 11 /* DO_BINARY_OP_STEREO */ : 10 /* DO_BINARY_OP */, this.op]);
  }
};
var UnaryOp = class _UnaryOp extends Node {
  constructor(trace, op2, value) {
    super(trace);
    this.op = op2;
    this.value = value;
  }
  static {
    __name(this, "UnaryOp");
  }
  edgemost(left) {
    return left ? this : this.value.edgemost(left);
  }
  async pipe(fn) {
    return new _UnaryOp(this.loc, this.op, await fn(this.value));
  }
  async eval(state) {
    return this._applied(await this.value.eval(state));
  }
  _applied(val) {
    var fn;
    var imm = true, value;
    if (isinstance(val, Value)) {
      value = val.value;
    } else if (isinstance(val, List) && val.isImmediate()) {
      value = val.toImmediate();
    } else {
      imm = false;
    }
    if (imm && (fn = OPERATORS[this.op]?.cu)) {
      return List.fromImmediate(this.loc, fn(value));
    }
    return new _UnaryOp(this.loc, this.op, val);
  }
  compile(state, refMap, ni) {
    compileNode(this.value, state, refMap, ni);
    state.p.push([state.tosStereo ? 13 /* DO_UNARY_OP_STEREO */ : 12 /* DO_UNARY_OP */, this.op]);
  }
};
var DefaultPlaceholder = class extends Leaf {
  static {
    __name(this, "DefaultPlaceholder");
  }
  async eval(state) {
    throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
  }
};
var KeywordArgument = class _KeywordArgument extends NotCodeNode {
  constructor(trace, name, arg) {
    super(trace);
    this.name = name;
    this.arg = arg;
  }
  static {
    __name(this, "KeywordArgument");
  }
  edgemost(left) {
    return left ? this : this.arg.edgemost(left);
  }
  async pipe(fn) {
    return new _KeywordArgument(this.loc, this.name, await fn(this.arg));
  }
  async eval(state) {
    return new _KeywordArgument(this.loc, this.name, await this.arg.eval(state));
  }
};
var Mapping = class _Mapping extends NotCodeNode {
  constructor(trace, mapping) {
    super(trace);
    this.mapping = mapping;
  }
  static {
    __name(this, "Mapping");
  }
  edgemost(left) {
    return this.mapping.length > 0 ? left ? this.mapping[0].key.edgemost(left) : this.mapping.at(-1).val.edgemost(left) : this;
  }
  async pipe(fn) {
    return new _Mapping(this.loc, await asyncNodePipe(this.mapping, async ({ key, val }) => ({ key: await fn(key), val: await fn(val) })));
  }
  async eval(state) {
    return new _Mapping(this.loc, await Promise.all(this.mapping.map(async ({ key, val }) => ({ key: await key.eval(state), val: await val.eval(state) }))));
  }
  async toJS(state) {
    const out = {};
    for (var { key, val } of this.mapping) {
      if (!isinstance(key, Symbol2)) {
        throw new Error("unreachable");
      }
      out[key.value] = await val.eval(state);
    }
    return out;
  }
};
var Conditional = class _Conditional extends Node {
  constructor(trace, cond, caseTrue, caseFalse) {
    super(trace);
    this.cond = cond;
    this.caseTrue = caseTrue;
    this.caseFalse = caseFalse;
  }
  static {
    __name(this, "Conditional");
  }
  edgemost(left) {
    return (left ? this.cond : this.caseFalse).edgemost(left);
  }
  async pipe(fn) {
    return new _Conditional(this.loc, await fn(this.cond), await fn(this.caseTrue), await fn(this.caseFalse));
  }
  async eval(state) {
    const cond = await this.cond.eval(state);
    if (isinstance(cond, Value)) {
      return (!cond.value ? this.caseFalse : this.caseTrue).eval(state);
    }
    const ct = await this.caseTrue.eval(state);
    const cf = await this.caseFalse.eval(state);
    return new _Conditional(this.loc, cond, ct, cf);
  }
  compile(state, refMap, ni) {
    compileNode(this.caseFalse, state, refMap, ni);
    const stereoF = state.tosStereo;
    const stereoI = state.p.length;
    compileNode(this.caseTrue, state, refMap, ni);
    const stereoT = state.tosStereo;
    if (state.tosStereo ||= stereoF) {
      if (!stereoT) makeStereoAtIndex(state.p, stereoI);
      if (!stereoF) makeStereoAtIndex(state.p);
    }
    compileNode(this.cond, state, refMap, ni);
    if (state.tosStereo) {
      throw new CompileError("cannot use stereo output as condition", this.cond.loc);
    }
    state.p.push([17 /* CONDITIONAL_SELECT */]);
  }
};
var InterpolatedValue = class _InterpolatedValue extends NotCodeNode {
  constructor(trace, value) {
    super(trace);
    this.value = value;
  }
  static {
    __name(this, "InterpolatedValue");
  }
  edgemost(left) {
    return this.value.edgemost(left);
  }
  async pipe(fn) {
    return new _InterpolatedValue(this.loc, await fn(this.value));
  }
  async eval(state) {
    throw new RuntimeError("too many &'s", this.loc, stackToNotes(state.callstack));
  }
};
var SplatValue = class _SplatValue extends NotCodeNode {
  constructor(trace, value) {
    super(trace);
    this.value = value;
  }
  static {
    __name(this, "SplatValue");
  }
  edgemost(left) {
    return this.value.edgemost(left);
  }
  async pipe(fn) {
    return new _SplatValue(this.loc, await fn(this.value));
  }
  async eval(state) {
    return new _SplatValue(this.loc, await this.value.eval(state));
  }
};
var PipePlaceholder = class extends Leaf {
  static {
    __name(this, "PipePlaceholder");
  }
  async eval(state) {
    throw new RuntimeError("not valid outside of a pipe expression", this.loc, stackToNotes(state.callstack));
  }
};
var Block = class _Block extends NotCodeNode {
  constructor(trace, body) {
    super(trace);
    this.body = body;
  }
  static {
    __name(this, "Block");
  }
  edgemost(left) {
    return this.body.length > 0 ? left ? this.body[0].edgemost(left) : this.body.at(-1).edgemost(left) : this;
  }
  async pipe(fn) {
    return new _Block(this.loc, await asyncNodePipe(this.body, fn));
  }
  async eval(state) {
    var last = new Value(this.loc, void 0);
    for (var v of this.body) {
      if (isinstance(v, DefaultPlaceholder)) last = new Value(v.loc, void 0);
      else last = await v.eval(state);
    }
    return last;
  }
};
async function asyncNodePipe(nodes, fn) {
  return await Promise.all(nodes.map(fn));
}
__name(asyncNodePipe, "asyncNodePipe");
function stackToNotes(stack) {
  const out = [];
  for (var s of stack) {
    out.push(new ErrorNote(`note: while evaluating function ${str(s.name)}`, s.loc));
  }
  return out.reverse();
}
__name(stackToNotes, "stackToNotes");
function scopeForName(name, state) {
  return Object.hasOwn(state.env, name) ? state.env : Object.hasOwn(state.globalEnv, name) ? state.globalEnv : state.env;
}
__name(scopeForName, "scopeForName");

// src/compiler/compile.ts
function newCompileData() {
  return {
    p: [],
    r: [],
    nn: [],
    tosStereo: false,
    mods: []
  };
}
__name(newCompileData, "newCompileData");
function makeStereoAtIndex(prog, index = prog.length) {
  const entryThere = prog[index - 1];
  if (entryThere[0] === 1 /* PUSH_CONSTANT */ && !isArray(entryThere[1])) {
    entryThere[1] = [entryThere[1], entryThere[1]];
  } else {
    prog.splice(index, 0, [18 /* STEREO_DOUBLE_WIDEN */]);
  }
}
__name(makeStereoAtIndex, "makeStereoAtIndex");
function compileNode(node, state, cache, ni) {
  if (isinstance(node, Value)) {
    node.compile(state);
    return state;
  }
  const entry = cache.get(node);
  const regname = "" + id(node);
  if (entry) {
    entry.t[0] = 15 /* TAP_REGISTER */;
    entry.t[1] = allocRegister(regname, state);
    state.p.push([14 /* GET_REGISTER */, allocRegister(regname, state)]);
    state.tosStereo = entry.s;
  } else {
    const myEntry = { s: false, t: [0 /* NOOP */] };
    cache.set(node, myEntry);
    node.compile(state, cache, ni);
    myEntry.s = state.tosStereo;
    state.p.push(myEntry.t);
  }
  return state;
}
__name(compileNode, "compileNode");
function optimizeProgram(state) {
  state.p = state.p.filter((i) => i[0] !== 0 /* NOOP */);
  return state;
}
__name(optimizeProgram, "optimizeProgram");

// src/compiler/tokenizer.ts
var Token = class {
  constructor(t, s, k, a) {
    this.t = t;
    this.s = s;
    this.k = k;
    this.a = a;
  }
  static {
    __name(this, "Token");
  }
};
var TOKENIZE_RULES = [
  // comments
  [[0 /* INITIAL */], /^\/\/[^\n]*/],
  [[0 /* INITIAL */, 1 /* BLOCK_COMMENT */], /^\/\*/, , 1 /* BLOCK_COMMENT */],
  [[1 /* BLOCK_COMMENT */], /^\*\//, , 4 /* POP */],
  [[1 /* BLOCK_COMMENT */], /^((?!(\*\/)|(\/\*)).)+/],
  // strings with escapes
  [[0 /* INITIAL */], /^"/, 5 /* STRING_BEGIN */, 2 /* STRING */],
  [[2 /* STRING */], /^"/, 6 /* STRING_END */, 4 /* POP */],
  [[2 /* STRING */], /^\\[abefnrtvz'"\\]/, 8 /* STRING_ESC */],
  [[2 /* STRING */], /^\\(x[0-9a-f]{2}|u[0-9a-f]{4}|u\{[0-9a-f]+\})/i, 8 /* STRING_ESC */],
  [[2 /* STRING */], /^\\./, 9 /* INVALID_STRING_ESCAPE */],
  [[2 /* STRING */], /^[^\\"]+/, 7 /* STRING_BODY */],
  // strings without escapes
  [[0 /* INITIAL */], /^'/, 5 /* STRING_BEGIN */, 3 /* RAW_STRING */],
  [[3 /* RAW_STRING */], /^'/, 6 /* STRING_END */, 4 /* POP */],
  [[3 /* RAW_STRING */], /^\\'/, 8 /* STRING_ESC */],
  [[3 /* RAW_STRING */], /^\\./, 7 /* STRING_BODY */],
  [[3 /* RAW_STRING */], /^[^\\']+/, 7 /* STRING_BODY */],
  // number
  [[0 /* INITIAL */], /^-?(\.\d+|\d+\.?\d*)(e[+-]?\d+)?/i, 1 /* NUMBER */],
  // operators
  [[0 /* INITIAL */], OP_REGEX, 3 /* OPERATOR */],
  // parens
  [[0 /* INITIAL */], /^[()[\]{}]/, 2 /* PAREN */],
  // names
  [[0 /* INITIAL */], /^\w+/, 0 /* NAME */],
  // discard whitespace elsewhere
  [[0 /* INITIAL */, 1 /* BLOCK_COMMENT */], /^[\s\n]+/]
];
function tokenize(source, filename) {
  var line = 0, col = 0;
  const out = [];
  const stateStack = [0 /* INITIAL */];
  tokens: while (source.length > 0) {
    for (var [curStates, regex, type, newState] of TOKENIZE_RULES) {
      if (curStates.every((s) => stateStack.at(-1) !== s)) continue;
      const match = regex.exec(source);
      if (match) {
        const chunk = match[0];
        if (type !== void 0) out.push(new Token(chunk, new LocationTrace(line, col, filename), type));
        const interlines = chunk.split("\n");
        if (interlines.length > 1) {
          col = interlines.at(-1).length;
          line += interlines.length - 1;
        } else {
          col += chunk.length;
        }
        source = source.slice(chunk.length);
        if (newState !== void 0) {
          if (newState === 4 /* POP */) stateStack.pop();
          else stateStack.push(newState);
        }
        continue tokens;
      }
    }
    throw new ParseError(`unexpected ${str(source[0])}`, new LocationTrace(line, col, filename));
  }
  return out;
}
__name(tokenize, "tokenize");

// src/compiler/expression.ts
function treeifyExpression(tokens, lift = false) {
  var i;
  attributesHack(tokens);
  pipePlaceholdersHack(tokens);
  commaAndAssignHack(tokens);
  const firstToken = tokens.find((t) => isinstance(t, Token));
  while (tokens.length > 1) {
    var bestBinaryPrecedence = Infinity, bestBinaryIndex = -1;
    var bestUnaryPrecedence = Infinity, bestUnaryIndex = -1;
    var prevWasAtom = false;
    const lastAtomIndex = tokens.findLastIndex((e) => isinstance(e, Node));
    for (i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (isinstance(token, Node)) prevWasAtom = true;
      else {
        if (i > lastAtomIndex) {
          throw new ParseError("expected a value after operator", token.s);
        }
        if (prevWasAtom) {
          const precedence = getPrecedenceAndCheckValidity(token, false);
          if (bestBinaryPrecedence > precedence || bestBinaryPrecedence === precedence && isRightAssociative(token.t)) {
            bestBinaryPrecedence = precedence;
            bestBinaryIndex = i;
          }
        } else {
          if (!isinstance(tokens[i + 1], Node)) continue;
          const mePrecedence = getPrecedenceAndCheckValidity(token, true);
          const opAfter = tokens[i + 2];
          if (opAfter) {
            const opAfterPrecedence = getPrecedenceAndCheckValidity(opAfter, false);
            if (opAfterPrecedence < mePrecedence) continue;
          }
          if (bestUnaryPrecedence > mePrecedence) {
            bestUnaryPrecedence = mePrecedence;
            bestUnaryIndex = i;
          }
        }
        prevWasAtom = false;
      }
    }
    if (bestUnaryIndex >= 0) {
      const [op2, val] = tokens.splice(bestUnaryIndex, 2);
      tokens.splice(bestUnaryIndex, 0, new UnaryOp(op2.s, op2.t, val));
    } else if (bestBinaryIndex >= 0) {
      const [left, op2, right] = tokens.splice(bestBinaryIndex - 1, 3);
      const math = new BinaryOp(op2.s, op2.t, left, right, false, op2.a);
      tokens.splice(bestBinaryIndex - 1, 0, math);
    } else {
      throw new ParseError("unknown error in expression parsing", firstToken?.s);
    }
  }
  const result = tokens[0];
  if (lift && isinstance(result, BinaryOp)) result.noLift = true;
  return result;
}
__name(treeifyExpression, "treeifyExpression");
function attributesHack(tokens) {
  var attrs = [];
  for (var i = 0; i < tokens.length; i++) {
    const here = tokens[i];
    if (isinstance(here, Token)) {
      if (here.t === "#!") {
        const value = tokens.splice(i, 2)[1];
        if (!(isinstance(value, Name) || isinstance(value, Call))) {
          throw new ParseError("expected attribute after '#!'", here.s);
        }
        attrs.push(value);
        i--;
      } else if (attrs.length > 0) {
        tokens.splice(i, 0, new AnnotatedValue(here.s, attrs, null));
        attrs = [];
      }
    } else if (attrs.length > 0) {
      tokens[i] = new AnnotatedValue(here.loc, attrs, here);
      attrs = [];
    }
  }
  if (attrs.length > 0) {
    tokens.push(new AnnotatedValue(attrs.at(-1).loc, attrs, null));
  }
}
__name(attributesHack, "attributesHack");
function pipePlaceholdersHack(tokens) {
  for (var i = 0; i < tokens.length; i++) {
    const before = tokens[i - 1];
    const here = tokens[i];
    const after = tokens[i + 1];
    if (isinstance(here, Token) && here.t === "#" && !(isinstance(before, Node) || isinstance(after, Node))) {
      tokens[i] = new PipePlaceholder(here.s);
    }
  }
}
__name(pipePlaceholdersHack, "pipePlaceholdersHack");
function commaAndAssignHack(tokens) {
  for (var i = -1; i < tokens.length; i++) {
    const here = tokens[i];
    const next = tokens[i + 1];
    if (commaIsh(here) && commaIsh(next)) {
      tokens.splice(i + 1, 0, new DefaultPlaceholder(next?.s ?? here?.s ?? LocationTrace.nowhere));
    } else if (tokenLike(here) && tokenLike(next) && here.k === 3 /* OPERATOR */ && next.k === 3 /* OPERATOR */ && next.t === "=") {
      tokens.splice(i, 2, new Token(here.t, here.s, here.k, next.s));
    } else if (isinstance(here, Node) && isinstance(next, Node)) {
      throw new ParseError("expected operator before value", next.edgemost(false).loc);
    }
  }
}
__name(commaAndAssignHack, "commaAndAssignHack");
function commaIsh(x) {
  return !x || tokenLike(x) && /^[,:;]$/.test(x.t);
}
__name(commaIsh, "commaIsh");
function tokenLike(x) {
  return isinstance(x, Token);
}
__name(tokenLike, "tokenLike");

// src/compiler/core.ts
function liftCommas(expr, force = false) {
  return isinstance(expr, BinaryOp) && /^[,;]$/.test(expr.op) && (force || !expr.noLift) ? [...liftCommas(expr.left), ...liftCommas(expr.right)] : [expr];
}
__name(liftCommas, "liftCommas");
function unescape(string) {
  return ({
    a: "a",
    b: "\b",
    e: "e",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "	",
    v: "\v",
    z: "\0",
    "'": "'",
    '"': '"',
    "\\": "\\",
    x: false,
    u: false
  }[string.toLowerCase()[0]] ?? string) || String.fromCodePoint(parseInt(/[0-9a-f]+/i.exec(string)[0], 16));
}
__name(unescape, "unescape");
function parseTokens(tokens) {
  var pos = 0;
  const nextToken = /* @__PURE__ */ __name((expect, beginParen) => {
    if (expect && pos >= tokens.length) {
      if (beginParen) {
        throw new ParseError(`${str(beginParen.t)} was never closed`, beginParen.s);
      }
      const last = tokens.at(-1);
      throw new ParseError("unexpected EOF", last?.s);
    }
    return tokens[pos++];
  }, "nextToken");
  const parseString = /* @__PURE__ */ __name((start) => {
    var out = "";
    str: for (; ; ) {
      const token = nextToken(true, start);
      switch (token.k) {
        case 6 /* STRING_END */:
          break str;
        case 7 /* STRING_BODY */:
          out += token.t;
          break;
        case 8 /* STRING_ESC */:
          out += unescape(token.t.slice(1));
          break;
        case 9 /* INVALID_STRING_ESCAPE */:
          throw new ParseError("illegal escape sequence", token.s);
      }
    }
    return new Value(start.s, out);
  }, "parseString");
  const parseThing = /* @__PURE__ */ __name((requireNext, beginParen) => {
    const token = nextToken(requireNext, beginParen);
    if (token === void 0) return void 0;
    switch (token.k) {
      case 1 /* NUMBER */:
        return new Value(token.s, parseFloat(token.t));
      case 5 /* STRING_BEGIN */:
        return parseString(token);
      case 0 /* NAME */:
        const after = nextToken(false);
        if (after && after.t === "(") {
          return new Call(token.s, token.t, liftCommas(parseExpression(")", after), true));
        }
        pos--;
        return new Name(token.s, token.t);
      // @ts-expect-error
      // fallthrough is intentional!
      case 2 /* PAREN */:
        switch (token.t) {
          case "{":
            return new Template(token.s, parseExpression("}", token));
          case "[":
            return new List(token.s, liftCommas(parseExpression("]", token), true));
          case "(":
            return parseExpression(")", token, true);
          case ")":
          case "]":
          case "}":
            throw new ParseError(beginParen ? `expected ${str({ "(": ")", "[": "]", "{": "}" }[beginParen.t])}` : "stray close paren", token.s, beginParen ? [new ErrorNote("note: to match this " + str(beginParen.t), beginParen.s)] : []);
        }
      case 3 /* OPERATOR */:
        if (!requireNext && /^[,;)]$/.test(token.t)) {
          pos--;
          return;
        }
    }
    throw new ParseError(`unexpected ${{ [0 /* NAME */]: "name", [3 /* OPERATOR */]: "operator" }[token.t] ?? str(token.t)}`, token.s);
  }, "parseThing");
  const parseExpression = /* @__PURE__ */ __name((end, beginParen, lift = false) => {
    const exprItems = [];
    for (; ; ) {
      var tok = nextToken(!!end, beginParen);
      if (!end && tok === void 0) break;
      if (tok.t === end) break;
      switch (tok.k) {
        case 3 /* OPERATOR */:
          exprItems.push(tok);
          break;
        default:
          pos--;
          const thing = parseThing(false, beginParen);
          if (thing !== void 0) exprItems.push(thing);
      }
    }
    return treeifyExpression(exprItems, lift);
  }, "parseExpression");
  return parseExpression(false);
}
__name(parseTokens, "parseTokens");

// src/compiler/pipe.ts
function isPipe(a) {
  return isinstance(a, BinaryOp) && a.op === "|>";
}
__name(isPipe, "isPipe");
async function countPlaceholdersIn(expr) {
  var numPlaceholders = 0;
  const count = /* @__PURE__ */ __name(async (ast) => {
    if (isinstance(ast, PipePlaceholder)) numPlaceholders++;
    if (isPipe(ast)) {
      await ast.left.pipe(count);
    } else {
      await ast.pipe(count);
    }
    return ast;
  }, "count");
  await count(expr);
  return numPlaceholders;
}
__name(countPlaceholdersIn, "countPlaceholdersIn");
async function replacePlaceholdersWith(ast, with_) {
  if (isinstance(ast, PipePlaceholder)) {
    return with_;
  } else if (isPipe(ast)) {
    return await ast.pipe(async (a) => a === ast.left ? a : await replacePlaceholdersWith(a, with_));
  } else {
    return await ast.pipe(async (a) => await replacePlaceholdersWith(a, with_));
  }
}
__name(replacePlaceholdersWith, "replacePlaceholdersWith");

// src/compiler/transformers.ts
var TRANSFORM_PASSES = [
  /* @__PURE__ */ __name(async function expandSymbols(ast) {
    if (!isinstance(ast, UnaryOp) || ast.op !== ".") return ast.pipe(expandSymbols);
    if (!isinstance(ast.value, Name)) {
      throw new ParseError('unexpected "."', ast.loc);
    }
    return new Symbol2(ast.value.loc, ast.value.name);
  }, "expandSymbols"),
  /* @__PURE__ */ __name(async function expandInterpolations(ast) {
    ast = await ast.pipe(expandInterpolations);
    if (isinstance(ast, UnaryOp) && ast.op === "&") ast = new InterpolatedValue(ast.loc, ast.value);
    return ast;
  }, "expandInterpolations"),
  /* @__PURE__ */ __name(async function expandMapping(ast) {
    ast = await ast.pipe(expandMapping);
    if (!isinstance(ast, List)) return ast;
    const elements = ast.values;
    const firstKVIndex = elements.findIndex((e) => isinstance(e, BinaryOp) && e.op === "=>");
    if (firstKVIndex < 0) {
      const firstColon = elements.find((e) => isinstance(e, BinaryOp) && e.op === ":");
      if (firstColon) {
        throw new ParseError('mappings use "=>", not ":"', firstColon.loc);
      }
      return ast;
    }
    const kvPairs = [];
    for (var i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!isinstance(el, BinaryOp) || el.op !== "=>") {
        throw new ParseError(isinstance(el, DefaultPlaceholder) ? "illegal trailing comma in mapping" : 'expected "=>" after key value', el.edgemost(false).loc, i < firstKVIndex ? [new ErrorNote('hint: the "=>" first used here makes this a mapping, not a list', elements[firstKVIndex].loc)] : []);
      }
      kvPairs.push({ key: el.left, val: el.right });
    }
    return new Mapping(ast.edgemost(true).loc, kvPairs);
  }, "expandMapping"),
  /* @__PURE__ */ __name(async function commasToBlocks(ast) {
    if (!isinstance(ast, BinaryOp) || ast.op !== "," && ast.op !== ";") return ast.pipe(commasToBlocks);
    return new Block(ast.edgemost(true).loc, await Promise.all(liftCommas(ast, true).map(commasToBlocks)));
  }, "commasToBlocks"),
  /* @__PURE__ */ __name(async function trimDefaultSentinelsInCallExpression(ast) {
    ast = await ast.pipe(trimDefaultSentinelsInCallExpression);
    if (isinstance(ast, Call))
      while (isinstance(ast.args.at(-1), DefaultPlaceholder)) ast.args.pop();
    return ast;
  }, "trimDefaultSentinelsInCallExpression"),
  /* @__PURE__ */ __name(async function trimDefaultSentinelsInBlock(ast) {
    ast = await ast.pipe(trimDefaultSentinelsInBlock);
    if (isinstance(ast, Block)) {
      for (var i = 0; i < ast.body.length; i++) {
        if (isinstance(ast.body[i], DefaultPlaceholder)) {
          ast.body.splice(i, 1);
          i--;
        }
      }
    }
    return ast;
  }, "trimDefaultSentinelsInBlock"),
  /* @__PURE__ */ __name(async function expandDefinitions(ast, alreadyExpanded = false) {
    if (!isinstance(ast, BinaryOp) || ast.op !== ":-") return ast.pipe(expandDefinitions);
    var header = alreadyExpanded ? ast.left : await ast.left.pipe(expandDefinitions);
    const body = alreadyExpanded ? ast.right : await ast.right.pipe(expandDefinitions);
    var isMacro = false;
    if (isinstance(header, UnaryOp) && header.op === "@") {
      header = header.value;
      isMacro = true;
    }
    if (!isinstance(header, Call)) {
      if (isinstance(header, AnnotatedValue) && header.value !== null) {
        ast.left = header.value;
        return new AnnotatedValue(header.loc, header.attributes, await expandDefinitions(ast, true));
      }
      throw new ParseError("illegal header", header.edgemost(true).loc, [new ErrorNote("note: definition operator is here", ast.loc)]);
    }
    const params = header.args;
    var firstOptional;
    const realParams = [];
    for (var i = 0; i < params.length; i++) {
      var param = params[i];
      var lazy = false;
      if (isinstance(param, UnaryOp) && param.op === "@") {
        param = param.value;
        lazy = true;
      }
      if (isinstance(param, Name)) {
        if (firstOptional) {
          throw new ParseError("required parameter follows optional parameter", param.loc, [new ErrorNote("note: first optional parameter is here", firstOptional.loc)]);
        }
        realParams.push(lazy ? new ParameterDescriptor(param.loc, param.name, new Mapping(param.loc, []), new DefaultPlaceholder(param.loc), true) : param);
        continue;
      }
      if (!isinstance(param, BinaryOp) || param.op !== ":" && param.op !== "=") {
        throw new ParseError("illegal parameter", param.edgemost(true).loc);
      }
      var name = param.left, enums, default_;
      switch (param.op) {
        case ":":
          default_ = void 0;
          if (!isinstance(param.right, Mapping)) {
            throw new ParseError("expected a mapping", param.right.loc);
          }
          enums = param.right;
          for (var { key } of enums.mapping) {
            if (!isinstance(key, Symbol2)) {
              throw new ParseError("expected a symbol here", key.edgemost(false).loc, [new ErrorNote(`note: while defining enum options for parameter`, name.loc), ...isinstance(key, Name) ? [new ErrorNote(`hint: put a "." before the ${str(key.name)} to make it a static symbol instead of a variable`, key.loc)] : []]);
            }
          }
          break;
        case "=":
          enums = new Mapping(param.loc, []);
          if (isinstance(name, BinaryOp) && name.op === ":") {
            if (!isinstance(name.right, Mapping)) {
              throw new ParseError("expected a mapping", name.right.loc);
            }
            enums = name.right;
            name = name.left;
          }
          default_ = param.right;
          break;
        default:
          throw "unreachable";
      }
      if (default_ === void 0) {
        default_ = new DefaultPlaceholder(name.loc);
      } else {
        if (!firstOptional) firstOptional = name;
      }
      if (isinstance(name, UnaryOp) && name.op === "@") {
        param = name.value;
        lazy = true;
      }
      if (!isinstance(name, Name)) {
        throw new ParseError("illegal parameter name for optional parameter", name.edgemost(false).loc);
      }
      realParams.push(new ParameterDescriptor(name.loc, name.name, enums, default_, lazy));
    }
    return new Definition(header.loc, header.name, isMacro, realParams, body);
  }, "expandDefinitions"),
  /* @__PURE__ */ __name(async function expandAssignments(ast) {
    if (!isinstance(ast, BinaryOp) || ast.op !== "=" && !ast.assign) return ast.pipe(expandAssignments);
    const target = await ast.left.pipe(expandAssignments);
    var body = await ast.right.pipe(expandAssignments);
    if (ast.assign) {
      body = new BinaryOp(ast.loc, ast.op, target, body);
    }
    return new Assignment(target.loc, target, body);
  }, "expandAssignments"),
  /* @__PURE__ */ __name(async function expandTernaryOperators(ast) {
    if (!isinstance(ast, BinaryOp) || ast.op !== "?") return ast.pipe(expandTernaryOperators);
    const condition = await ast.left.pipe(expandTernaryOperators);
    const choices = await ast.right.pipe(expandTernaryOperators);
    if (!isinstance(choices, BinaryOp) || choices.op !== ":") {
      throw new ParseError('expected ":" after expression', (isinstance(choices, BinaryOp) ? choices : choices.edgemost(false)).loc, [new ErrorNote('note: "?" is here:', ast.loc)]);
    }
    return new Conditional(ast.loc, condition, choices.left, choices.right);
  }, "expandTernaryOperators"),
  /* @__PURE__ */ __name(async function createKeywordArguments(ast, parent = null) {
    if (!isinstance(ast, BinaryOp) || ast.op !== ":") return ast.pipe((e) => createKeywordArguments(e, ast));
    const name = await ast.left.pipe((e) => createKeywordArguments(e));
    const value = await ast.right.pipe((e) => createKeywordArguments(e));
    if (!isinstance(name, Name)) {
      throw isinstance(parent, Call) ? new ParseError('expected name before ":"', name.edgemost(false).loc) : new ParseError('unexpected ":"', ast.loc);
    }
    if (!isinstance(parent, Call) && !isinstance(parent, Definition)) {
      throw new ParseError("named parameter not directly inside a callsite", name.loc);
    }
    return new KeywordArgument(name.loc, name.name, value);
  }, "createKeywordArguments"),
  /* @__PURE__ */ __name(async function fixAndValidateListDefaultSentinels(ast) {
    if (!isinstance(ast, List)) return ast.pipe(fixAndValidateListDefaultSentinels);
    const args = await Promise.all(ast.values.map(fixAndValidateListDefaultSentinels));
    if (args.length === 1 && isinstance(args[0], DefaultPlaceholder)) {
      return new List(ast.loc, []);
    }
    for (var i = 0; i < args.length; i++) {
      const el = args[i];
      if (isinstance(el, DefaultPlaceholder)) {
        throw new ParseError(i + 1 === args.length ? "illegal trailing comma in list" : "empty elements not allowed in list", el.loc, [new ErrorNote("note: list starts here", ast.loc)]);
      }
    }
    return new List(ast.loc, args);
  }, "fixAndValidateListDefaultSentinels"),
  /* @__PURE__ */ __name(async function transformUnarySplatOperators(ast) {
    if (!isinstance(ast, UnaryOp) || ast.op !== "*") return ast.pipe(transformUnarySplatOperators);
    return new SplatValue(ast.loc, await ast.value.pipe(transformUnarySplatOperators));
  }, "transformUnarySplatOperators"),
  /* @__PURE__ */ __name(async function expandPipeOperators(ast) {
    ast = await ast.pipe(expandPipeOperators);
    if (!isPipe(ast)) return ast;
    const sym = new Name(ast.loc, ["_pipe", ast.loc.file.replace(/[^a-z]/ig, ""), ast.loc.line, ast.loc.col].join("_"));
    const arg = ast.left;
    const expr = ast.right;
    const numPlaceholders = await countPlaceholdersIn(expr);
    if (numPlaceholders === 0) {
      throw new ParseError("missing '#' placeholder in pipe expression", expr.loc, [new ErrorNote("note: required by this pipe operator", ast.loc)]);
    } else if (numPlaceholders > 1 && !isinstance(arg, Value)) {
      return new Block(ast.loc, [new Assignment(ast.loc, sym, arg), await replacePlaceholdersWith(expr, sym)]);
    } else {
      return replacePlaceholdersWith(expr, arg);
    }
  }, "expandPipeOperators")
];
async function transformAST(ast) {
  for (var transformer of TRANSFORM_PASSES) {
    ast = await transformer(ast);
  }
  return ast;
}
__name(transformAST, "transformAST");

// src/compiler/index.ts
function parse(src, filename) {
  return transformAST(parseTokens(tokenize(src, filename)));
}
__name(parse, "parse");

export {
  __name,
  Opcode,
  TAU,
  sin,
  cos,
  sgn,
  abs,
  tan,
  saw,
  tri,
  noise3,
  noise5,
  isNumber,
  isArray,
  str,
  isinstance,
  LocationTrace,
  ErrorNote,
  SydError,
  ParseError,
  RuntimeError,
  CompileError,
  newCompileData,
  compileNode,
  optimizeProgram,
  OPERATORS,
  Node,
  NotCodeNode,
  Leaf,
  AnnotatedValue,
  Value,
  Symbol2 as Symbol,
  Assignment,
  Name,
  LateBinding,
  Call,
  List,
  Definition,
  ParameterDescriptor,
  Template,
  BinaryOp,
  UnaryOp,
  DefaultPlaceholder,
  KeywordArgument,
  Mapping,
  Conditional,
  InterpolatedValue,
  SplatValue,
  PipePlaceholder,
  Block,
  stackToNotes,
  ast_exports,
  parse
};
//# sourceMappingURL=chunk-Y5AIDCJX.js.map
