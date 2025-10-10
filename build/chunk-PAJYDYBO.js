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
  ":": op(9),
  "?": op(10),
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

export {
  __name,
  __export,
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
  OPERATORS,
  OP_REGEX,
  getPrecedenceAndCheckValidity,
  isRightAssociative,
  allocRegister,
  allocNode
};
//# sourceMappingURL=chunk-PAJYDYBO.js.map
