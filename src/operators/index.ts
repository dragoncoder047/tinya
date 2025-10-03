/** constant used to note that an operator is not valid in this context (unary or binary) */
export const INVALID = -1;

class Operator {
    cb: ((this: never, a: any, b: any) => any) | null = null;
    cu: ((this: never, a: any) => any) | null = null;
    constructor(
        public b: number,
        public u: number = INVALID,
        public r: boolean = false) { }
    code(b: this["cb"], u: this["cu"] = null) {
        this.cb = b;
        this.cu = u;
    }
}

const op: (...args: ConstructorParameters<typeof Operator>) => Operator = (b, u, r) => new Operator(b, u, r);

export const OPERATORS: Record<string, Operator> = {
    // attribute sigil
    "#!": op(INVALID, -Infinity),
    // symbol name
    ".": op(INVALID, -Infinity),
    // interpolate
    "&": op(INVALID, 0),
    // length or as 0-ary pipeline placeholder (that is handled specially)
    "#": op(INVALID, 0),
    // boolean NOT
    "!": op(INVALID, 0),
    // power
    "^": op(1, INVALID, true),
    // multiply or splat operator
    "*": op(3, -Infinity),
    // divide
    "/": op(3),
    // matrix multiply
    "@": op(3),
    // add
    "+": op(4),
    // subtract, negate
    "-": op(4, 2),
    // boolean OR / AND
    "||": op(5),
    "&&": op(5),
    // comparison
    "==": op(6),
    ">=": op(6),
    ">": op(6),
    "<=": op(6),
    "<": op(6),
    "!=": op(6),
    // pipe
    "|>": op(7),
    // each pipe
    "*>": op(7),
    // reduce pipe
    "+>": op(7),
    // conditional in 2 parts (treated as binary and postprocessed for simplicity)
    ":": op(8),
    "?": op(9),
    // assignment operator (no overloads and handles specially, just here so it can be parsed in the right spot)
    "=": op(10),
    // mapping operator (for inside lists)
    "=>": op(10),
    // define operator (handled specially)
    ":-": op(11),
    // statement separator
    ",": op(12),
    ";": op(12),
};


