import { beforeEach, test } from "bun:test";
import { AST } from "../src/compiler/ast";
import { EvalState, NodeValueType } from "../src/compiler/env";
import { LocationTrace } from "../src/compiler/errors";
import { expectEval, expectEvalError } from "./astCheck";

var dummyState: EvalState;
beforeEach(() => {
    const N = LocationTrace.nowhere;
    dummyState = {
        globalEnv: {
            a: new AST.Value(N, 1),
            b: new AST.Value(N, 2),
            c: new AST.Value(N, 3),
            d: new AST.Value(N, 4),
        },
        env: {},
        macros: [
            [
                "reverse3",
                3,
                async args => {
                    const [a, b, c] = args as [AST.Node, AST.Node, AST.Node];
                    return new AST.List(c.edgemost(false).loc, [c, b, a]);
                }
            ]
        ],
        nodes: [
            [
                "foo",
                [["bar", null], ["baz", null]],
                NodeValueType.NORMAL,
                [, { opt1: 2, opt2: 3 }],
                () => () => 1,
            ]
        ],
        callstack: [],
        annotators: {
            async test(x, args, state) {
                return x!;
            }
        }
    };
    dummyState.env = Object.create(dummyState.globalEnv);
})

test("variable resolution", async () => {
    await expectEval("a", dummyState, {
        __class__: AST.Value,
        value: 1
    });
});
test("variable assignment", async () => {
    await expectEval("a = 111", dummyState, {
        __class__: AST.Value,
        value: 111,
    });
    await expectEval("a", dummyState, {
        __class__: AST.Value,
        value: 111
    });
});
test("variable assignment 2", async () => {
    await expectEval("a = foo(1, 2); a", dummyState, {
        __class__: AST.Call,
        name: "foo",
        args: [
            {
                __class__: AST.Value,
                value: 1,
            },
            {
                __class__: AST.Value,
                value: 2,
            }
        ]
    });
    await expectEval("a", dummyState, {
        __class__: AST.Call,
        name: "foo",
        args: [
            {
                __class__: AST.Value,
                value: 1,
            },
            {
                __class__: AST.Value,
                value: 2,
            }
        ]
    });
});
test("simple math", async () => {
    await expectEval("1 + 2 * 3", dummyState, {
        __class__: AST.Value,
        value: 7
    });
});
test("side effects from inside a scope", async () => {
    await expectEval("f(a) :- b += a; f(1); b", dummyState, {
        __class__: AST.Value,
        value: 3
    });
});
test("new inner variables that aren't parameters don't leak", async () => {
    await expectEval("f(a) :- (x = a * 2, x * a); f(10)", dummyState, {
        __class__: AST.Value,
        value: 200
    });
    await expectEvalError("x", dummyState, "undefined: x");
});
test("conditional elimination", async () => {
    await expectEval("1 == 1 ? a : notdefined", dummyState, {
        __class__: AST.Value,
        value: 1
    });
});
test("inner expressions evaluated", async () => {
    await expectEval("[1+1, 2+2, 2^(1/12)]", dummyState, {
        __class__: AST.List,
        values: [
            {
                __class__: AST.Value,
                value: 2
            },
            {
                __class__: AST.Value,
                value: 4
            },
            {
                __class__: AST.Value,
                value: Math.pow(2, 1 / 12),
            }
        ]
    });
});
test("concatenating with strings", async () => {
    await expectEval("'Hello, ' + 'World!'", dummyState, {
        __class__: AST.Value,
        value: "Hello, World!"
    });
});
test("list splat flattening", async () => {
    await expectEval("[1, *[2, *[3], 4]]", dummyState, {
        __class__: AST.List,
        values: [
            {
                __class__: AST.Value,
                value: 1
            },
            {
                __class__: AST.Value,
                value: 2
            },
            {
                __class__: AST.Value,
                value: 3
            },
            {
                __class__: AST.Value,
                value: 4
            }
        ]
    });
});
test("pipe constant folding", async () => {
    await expectEval("100 + 245 |> (# + # + 'abc' + #)", dummyState, {
        __class__: AST.Value,
        value: "690abc345"
    });
});
test("length constant folding for a constant length list", async () => {
    await expectEval("1 |> (#[a, #b]+#)", dummyState, {
        __class__: AST.Value,
        value: 3
    });
});
test("length constant folding for a constant length list with splats", async () => {
    await expectEval("1 |> (#[a, *[1, 2, 3]]+#)", dummyState, {
        __class__: AST.Value,
        value: 5
    });
});
test("no length constant folding for a list with unfoldable splats in it", async () => {
    await expectEval("#[1, *a]", dummyState, {
        __class__: AST.UnaryOp,
        op: "#",
        value: {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.SplatValue,
                    value: {
                        __class__: AST.Value,
                        value: 1
                    }
                }
            ]
        }
    });
});
test("folding immediate lists", async () => {
    await expectEval("#[1, *[*a, 1]]", dummyState, {
        __class__: AST.UnaryOp,
        op: "#",
        value: {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.SplatValue,
                    value: {
                        __class__: AST.Value,
                        value: 1
                    }
                },
                {
                    __class__: AST.Value,
                    value: 1,
                },
            ]
        }
    });
});
test("looking up node names", async () => {
    await expectEval("foo(1, b)", dummyState, {
        __class__: AST.Call,
        name: "foo",
        args: [
            {
                __class__: AST.Value,
                value: 1
            },
            {
                __class__: AST.Value,
                value: 2
            }
        ]
    });
});
test("node key params", async () => {
    await expectEval("foo(1, .opt1)", dummyState, {
        __class__: AST.Call,
        name: "foo",
        args: [
            {
                __class__: AST.Value,
                value: 1,
            },
            {
                __class__: AST.Value,
                value: 2
            }
        ]
    });
});
test("node key no names", async () => {
    await expectEvalError("foo(.a, 1)", dummyState, "symbol constant not valid here");
    await expectEvalError("foo(1, .a)", dummyState, 'unknown symbol name "a" for parameter');
});
test("too few/many arguments", async () => {
    await expectEvalError("foo()", dummyState, "missing value for argument bar");
    await expectEvalError("foo(1, 2, 3)", dummyState, "too many arguments to foo");
});
test("looking up macros", async () => {
    await expectEval("reverse3(1, 2, 3)", dummyState, {
        __class__: AST.List,
        values: [
            {
                __class__: AST.Value,
                value: 3
            },
            {
                __class__: AST.Value,
                value: 2
            },
            {
                __class__: AST.Value,
                value: 1
            }
        ]
    });
});
test("templates 1", async () => {
    await expectEval("{a, &a}", dummyState, {
        __class__: AST.Block,
        body: [
            {
                __class__: AST.Name,
                name: "a",
            },
            {
                __class__: AST.Value,
                value: 1
            }
        ]
    });
});
test("templates 2", async () => {
    await expectEval("{{&a, &(&a)}}", dummyState, {
        __class__: AST.Template,
        result: {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.InterpolatedValue,
                    value: {
                        __class__: AST.Name,
                        name: "a",
                    }
                },
                {
                    __class__: AST.Value,
                    value: 1
                }
            ]
        }
    });
});
test("definitions", async () => {
    await expectEval("myMacro(x, y) :- (y *= 2, y + x)", dummyState, {});
    await expectEval("myMacro(100, 1000)", dummyState, {
        __class__: AST.Value,
        value: 2100
    });
    await expectEvalError("y", dummyState, "undefined: y");
});
test("definitions with valid options", async () => {
    await expectEval("func(a: [.a => 1, .b => 2] = -1) :- a; func(.a + .a + .b)", dummyState, {
        __class__: AST.Value,
        value: 4
    });
});
test("fibonacci", async () => {
    await expectEval("fibonacci(a) :- a <= 1 ? a : {fibonacci(&a - 1) + fibonacci(&a - 2)}; fibonacci(20)", dummyState, {
        __class__: AST.Value,
        value: 6765
    });
});
test("factorial", async () => {
    await expectEval("factorial(a) :- a > 1 ? {&a * factorial(&a - 1)} : 1; factorial(15)", dummyState, {
        __class__: AST.Value,
        value: 1307674368000
    });
});
test("matrix multiply", async () => {
    await expectEval("[[1, 2, 3]] @ [[1, 2], [3, 4], [5, 6]]", dummyState, {
        __class__: AST.List,
        values: [
            {
                __class__: AST.List,
                values: [
                    {
                        __class__: AST.Value,
                        value: 22
                    },
                    {
                        __class__: AST.Value,
                        value: 28
                    }
                ]
            }
        ]
    });
});
