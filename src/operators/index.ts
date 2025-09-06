class Operator {
    constructor(
        public bin: number | undefined,
        public unary: number | undefined = undefined,
        public right: boolean = false
    ) { }
}
export const OPERATORS: Record<string, Operator> = {
    // symbol name
    ".": new Operator(undefined, -Infinity),
    // interpolate
    "&": new Operator(undefined, 0),
    // length
    "#": new Operator(undefined, 0),
    // boolean NOT
    "!": new Operator(undefined, 0),
    // power
    "^": new Operator(1, undefined, true),
    // multiply / divide
    "*": new Operator(3),
    "/": new Operator(3),
    // add
    "+": new Operator(4),
    // subtract, negate
    "-": new Operator(4, 2),
    // boolean OR / AND
    "||": new Operator(5),
    "&&": new Operator(5),
    // comparison
    "==": new Operator(6),
    ">=": new Operator(6),
    ">": new Operator(6),
    "<=": new Operator(6),
    "<": new Operator(6),
    "!=": new Operator(6),
    // pipe
    "|>": new Operator(7),
    // each pipe
    "*>": new Operator(7),
    // reduce pipe
    "+>": new Operator(7),
    // conditional in 2 parts (treated as binary and postprocessed for simplicity)
    ":": new Operator(8),
    "?": new Operator(9),
    // assignment operator (no overloads and handles specially, just here so it can be parsed in the right spot)
    "=": new Operator(10),
    // mapping operator (for inside lists)
    "=>": new Operator(10),
    // define operator (handled specially)
    ":-": new Operator(11),
    // statement separator
    ",": new Operator(12),
};


