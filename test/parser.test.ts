import { test } from "bun:test";
import { AST } from "../src/compiler/ast";
import { describe } from "node:test";
import { expectAST, expectParseError } from "./astCheck";

describe("parse primitive values", () => {
    test("number", async () => {
        await expectAST("123.456e+78", {
            __class__: AST.Value,
            value: 123.456e+78
        });
    });
    test("negative number", async () => {
        await expectAST("-1", {
            __class__: AST.Value,
            value: -1
        });
    });
    test("regular string", async () => {
        await expectAST('"hello!\\nworld!"', {
            __class__: AST.Value,
            value: "hello!\nworld!"
        });
    });
    test("raw string", async () => {
        await expectAST("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
        await expectAST("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
    });
    test("string with escaped quote", async () => {
        await expectAST('"hello \\"quoted\\" world"', {
            __class__: AST.Value,
            value: 'hello "quoted" world',
        });
    });
    test("raw string with escaped quote", async () => {
        await expectAST("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
    });
    test("raw string with escaped quote", async () => {
        await expectAST("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
        await expectAST("'hello \\'quoted\\' world'", {
            __class__: AST.Value,
            value: "hello 'quoted' world",
        });
    });
    test("Unicode escape", async () => {
        await expectAST('"\\u{1F914}"', {
            __class__: AST.Value,
            value: "\u{1F914}"
        });
    });
    test("ignore Unicode escape in raw string", async () => {
        await expectAST("'\\u{1F914}'", {
            __class__: AST.Value,
            value: "\\u{1F914}"
        });
    });
    test("symbol", async () => {
        await expectAST(".foo", {
            __class__: AST.Symbol,
            value: "foo"
        });
    });
    test("variable name", async () => {
        await expectAST("a", {
            __class__: AST.Name,
            name: "a"
        });
    });
});
describe("parse expressions", () => {
    test("implicit operator precedence", async () => {
        await expectAST("a + b * c", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.Name,
                name: "a",
            },
            right: {
                __class__: AST.BinaryOp,
                op: "*",
                left: {
                    __class__: AST.Name,
                    name: "b"
                },
                right: {
                    __class__: AST.Name,
                    name: "c",
                }
            }
        });
    });
    test("parens force order", async () => {
        await expectAST("(a + 2) * 3", {
            __class__: AST.BinaryOp,
            op: "*",
            left: {
                __class__: AST.BinaryOp,
                op: "+",
                left: {
                    __class__: AST.Name,
                    name: "a",
                },
                right: {
                    __class__: AST.Value,
                    value: 2,
                }
            },
            right: {
                __class__: AST.Value,
                value: 3,
            },
        });
    });
    test("exponentiation is right associative", async () => {
        await expectAST("2 ^ a ^ 4", {
            __class__: AST.BinaryOp,
            op: "^",
            left: {
                __class__: AST.Value,
                value: 2,
            },
            right: {
                __class__: AST.BinaryOp,
                op: "^",
                left: {
                    __class__: AST.Name,
                    name: "a",
                },
                right: {
                    __class__: AST.Value,
                    value: 4,
                }
            }
        });
    });
    test("unary minus comes after exponentiation", async () => {
        await expectAST("-a ^ x", {
            __class__: AST.UnaryOp,
            op: "-",
            value: {
                __class__: AST.BinaryOp,
                op: "^",
                left: {
                    __class__: AST.Name,
                    name: "a",
                },
                right: {
                    __class__: AST.Name,
                    name: "x"
                }
            }
        });
    });
    test("unary minus doesn't come after exponentiation with a number", async () => {
        await expectAST("-1 ^ x", {
            __class__: AST.BinaryOp,
            op: "^",
            left: {
                __class__: AST.Value,
                value: -1,
            },
            right: {
                __class__: AST.Name,
                name: "x"
            }
        });
    });
    test("parses splat form", async () => {
        await expectAST("foo(*bar())", {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.SplatValue,
                    value: {
                        __class__: AST.Call,
                        name: "bar",
                        args: []
                    }
                }
            ]
        })
    });
    test("parses matrix multiplication form with correct precedence", async () => {
        await expectAST("a^t @ b + c", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.BinaryOp,
                op: "@",
                left: {
                    __class__: AST.BinaryOp,
                    op: "^",
                    left: {
                        __class__: AST.Name,
                        name: "a"
                    },
                    right: {
                        __class__: AST.Name,
                        name: "t"
                    }
                },
                right: {
                    __class__: AST.Name,
                    name: "b"
                }
            },
            right: {
                __class__: AST.Name,
                name: "c"
            }
        });
    });
    test("no postfix operators", async () => {
        await expectParseError("1 +", "expected a value after operator");
    });
    test("unmatched parens", async () => {
        await expectParseError("(abc234(1, 4)", '"(" was never closed');
        await expectParseError("[{a: 1, b: 3", '"{" was never closed');
        await expectParseError("[1 => 2, 3 => [", '"[" was never closed');
        await expectParseError("]:", "stray close paren");
        await expectParseError("}:-", "stray close paren");
        await expectParseError(":)", "stray close paren");
    });
    test("mismatched parens", async () => {
        await expectParseError("[a, b)", 'expected "]"');
    });
});
describe("parse assignment statements", () => {
    test("simple assignment", async () => {
        await expectAST("a = 1", {
            __class__: AST.Assignment,
            name: "a",
            value: {
                __class__: AST.Value,
                value: 1
            }
        });
    });
    test("compound assignment", async () => {
        await expectAST("a += 1", {
            __class__: AST.Assignment,
            name: "a",
            value: {
                __class__: AST.BinaryOp,
                op: "+",
                left: {
                    __class__: AST.Name,
                    name: "a"
                },
                right: {
                    __class__: AST.Value,
                    value: 1
                }
            }
        });
    });
});
describe("parse call", () => {
    test("standard", async () => {
        await expectAST("foo(1, a)", {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Name,
                    name: "a"
                }
            ]
        });
    });
    test("with keyword arguments", async () => {
        await expectAST("foo(1, 2, a: 3, b: 4)", {
            __class__: AST.Call,
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                },
                {
                    __class__: AST.KeywordArgument,
                    name: "a",
                    arg: {
                        __class__: AST.Value,
                        value: 3,
                    }
                },
                {
                    __class__: AST.KeywordArgument,
                    name: "b",
                    arg: {
                        __class__: AST.Value,
                        value: 4,
                    }
                }
            ]
        });
    });
});
describe("parse list", () => {
    test("normal list", async () => {
        await expectAST("[1, a]", {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Name,
                    name: "a"
                }
            ]
        });
    });
    test("throw error about empty slots in list", async () => {
        await expectParseError("[1, 2, ]", "illegal trailing comma in list");
        await expectParseError("[1, , 2]", "empty elements not allowed in list");
    });
    test("empty list", async () => {
        await expectAST("[]", {
            __class__: AST.List,
            values: []
        });
    });
    test("empty list 2-deep", async () => {
        await expectAST("[[]]", {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.List,
                    values: []
                }
            ]
        });
    });
});
describe("parse mapping", () => {
    test("parse mapping like a list", async () => {
        await expectAST("[1 => 2, .foo => .bar]", {
            __class__: AST.Mapping,
            mapping: [
                {
                    key: {
                        __class__: AST.Value,
                        value: 1,
                    },
                    val: {
                        __class__: AST.Value,
                        value: 2,
                    }
                },
                {
                    key: {
                        __class__: AST.Symbol,
                        value: "foo",
                    },
                    val: {
                        __class__: AST.Symbol,
                        value: "bar",
                    }
                }
            ]
        });
    });
    test('error when not all entries have "=>"', async () => {
        await expectParseError("[1, 2, 3 => 4]", 'expected "=>" after key value');
        await expectParseError("[1 => 2, 3, 4]", 'expected "=>" after key value');
    });
    test("arbitrary expressions as key & value", async () => {
        await expectAST("[1 + a => 3 + a]", {
            __class__: AST.Mapping,
            mapping: [
                {
                    key: {
                        __class__: AST.BinaryOp,
                        op: "+",
                        left: {
                            __class__: AST.Value,
                            value: 1,
                        },
                        right: {
                            __class__: AST.Name,
                            name: "a",
                        }
                    },
                    val: {
                        __class__: AST.BinaryOp,
                        op: "+",
                        left: {
                            __class__: AST.Value,
                            value: 3,
                        },
                        right: {
                            __class__: AST.Name,
                            name: "a",
                        }
                    }
                }
            ]
        });
    });
});
describe("parse ternary operator", () => {
    test("lift 2 binary operators", async () => {
        await expectAST("a ? b : c", {
            __class__: AST.Conditional,
            cond: {
                __class__: AST.Name,
                name: "a",
            },
            caseTrue: {
                __class__: AST.Name,
                name: "b",
            },
            caseFalse: {
                __class__: AST.Name,
                name: "c",
            }
        });
    });
    test("error when only half present", async () => {
        await expectParseError("a ? b", 'expected ":" after expression');
        await expectParseError("b : c", "named parameter not directly inside a callsite");
    });
});
describe("parse definition", () => {
    test("simple definition", async () => {
        await expectAST("foo(a, b) :- 1", {
            __class__: AST.Definition,
            name: "foo",
            parameters: [
                {
                    __class__: AST.Name,
                    name: "a",
                },
                {
                    __class__: AST.Name,
                    name: "b"
                }
            ],
            body: {
                __class__: AST.Value,
                value: 1,
            }
        });
    });
});
describe("parse block of commas", () => {
    test("defaults at all but end get trimmed", async () => {
        await expectAST(",1, ,2, 3,", {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                },
                {
                    __class__: AST.Value,
                    value: 3,
                },
                {
                    __class__: AST.DefaultPlaceholder
                }
            ],
        });
    });
    test("normal commas", async () => {
        await expectAST("1, 2, 3", {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                },
                {
                    __class__: AST.Value,
                    value: 3,
                }
            ],
        });
    });
});
describe("parse template and interpolation", () => {
    test("single template", async () => {
        await expectAST("{foo(), bar()}", {
            __class__: AST.Template,
            result: {
                __class__: AST.Block,
                body: [
                    {
                        __class__: AST.Call,
                        name: "foo",
                        args: []
                    },
                    {
                        __class__: AST.Call,
                        name: "bar",
                        args: []
                    },
                ]
            }
        });
    });
    test("template with interpolation", async () => {
        await expectAST("{foo(), &bar}", {
            __class__: AST.Template,
            result: {
                __class__: AST.Block,
                body: [
                    {
                        __class__: AST.Call,
                        name: "foo",
                        args: []
                    },
                    {
                        __class__: AST.InterpolatedValue,
                        value: {
                            __class__: AST.Name,
                            name: "bar"
                        }
                    },
                ]
            }
        });
    })
});

describe("pipeline placeholder", () => {
    test("parses pipe placeholder form", async () => {
        await expectAST("bar(#, 1, #)", {
            __class__: AST.Call,
            name: "bar",
            args: [
                {
                    __class__: AST.PipePlaceholder,
                },
                {
                    __class__: AST.Value,
                    value: 1
                },
                {
                    __class__: AST.PipePlaceholder,
                }
            ]
        })
    });
});
describe("parses and attaches attributes", () => {
    test("simple attributes on a definition", async () => {
        await expectAST("#!preset foo(a, b) :- 1", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Name,
                    name: "preset"
                }
            ],
            value: {
                __class__: AST.Definition,
                name: "foo",
                parameters: [
                    {
                        __class__: AST.Name,
                        name: "a",
                    },
                    {
                        __class__: AST.Name,
                        name: "b"
                    }
                ],
                body: {
                    __class__: AST.Value,
                    value: 1,
                }
            }
        });
    });
    test("complex attribute on a definition", async () => {
        await expectAST("#!preset('FM Sine') fmSine(a) :- 1", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Call,
                    name: "preset",
                    args: [
                        {
                            __class__: AST.Value,
                            value: "FM Sine"
                        },
                    ]
                }
            ],
            value: {
                __class__: AST.Definition,
                name: "fmSine",
                parameters: [
                    {
                        __class__: AST.Name,
                        name: "a",
                    },
                ],
                body: {
                    __class__: AST.Value,
                    value: 1,
                }
            }
        });
    });
    test("complex attribute 2", async () => {
        await expectAST("#!preset('FM Sine', category: 'Retro') fmSine(a) :- 1", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Call,
                    name: "preset",
                    args: [
                        {
                            __class__: AST.Value,
                            value: "FM Sine"
                        },
                        {
                            __class__: AST.KeywordArgument,
                            name: "category",
                            arg: {
                                __class__: AST.Value,
                                value: "Retro"
                            }
                        }
                    ]
                }
            ],
            value: {
                __class__: AST.Definition,
                name: "fmSine",
                parameters: [
                    {
                        __class__: AST.Name,
                        name: "a",
                    },
                ],
                body: {
                    __class__: AST.Value,
                    value: 1,
                }
            }
        });
    });
    test("simple attributes as a value in context", async () => {
        await expectAST("zz(#!pitch) + 1", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.Call,
                name: "zz",
                args: [
                    {
                        __class__: AST.AnnotatedValue,
                        value: null,
                        attributes: [
                            {
                                __class__: AST.Name,
                                name: "pitch"
                            }
                        ]
                    }
                ]
            },
            right: {
                __class__: AST.Value,
                value: 1
            }
        })
    });
    test("complex attributes as a value", async () => {
        await expectAST("#!mod(0, 1)", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Call,
                    name: "mod",
                    args: [
                        {
                            __class__: AST.Value,
                            value: 0
                        },
                        {
                            __class__: AST.Value,
                            value: 1
                        }
                    ]
                }
            ],
            value: null
        });
    });
    test("attribute used as value if cannot annotate expression", async () => {
        await expectAST("#!z + y", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.AnnotatedValue,
                attributes: [
                    {
                        __class__: AST.Name,
                        name: "z",
                    }
                ],
                value: null
            },
            right: {
                __class__: AST.Name,
                name: "y"
            }
        });
    });
    test("EOF'ed attribute", async () => {
        await expectParseError("#!", "expected attribute after '#!'")
    });
    test("attribute in invalid location", async () => {
        await expectParseError("a #!z + y", "expected operator before value");
    });
});
describe("expand simple pipe operators", () => {
    test("dumb pipe", async () => {
        await expectAST("a |> #", {
            __class__: AST.Name,
            name: "a",
        });
    });
    test("simple pipe expansion", async () => {
        await expectAST("foo() |> # * 2", {
            __class__: AST.BinaryOp,
            op: "*",
            left: {
                __class__: AST.Call,
                name: "foo",
                args: []
            },
            right: {
                __class__: AST.Value,
                value: 2
            }
        });
    });
    test("chained pipe expansion", async () => {
        await expectAST("foo() |> bar(#) |> baz(#)", {
            __class__: AST.Call,
            name: "baz",
            args: [
                {
                    __class__: AST.Call,
                    name: "bar",
                    args: [
                        {
                            __class__: AST.Call,
                            name: "foo",
                            args: []
                        }
                    ]
                }
            ]
        });
    });
    test("multiple targets for expansion", async () => {
        await expectAST("foo() |> (# ? # : 1)", {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Assignment,
                    name: "_pipe_teststring_0_6",
                    value: {
                        __class__: AST.Call,
                        name: "foo",
                        args: []
                    }
                },
                {
                    __class__: AST.Conditional,
                    cond: {
                        __class__: AST.Name,
                        name: "_pipe_teststring_0_6"
                    },
                    caseTrue: {
                        __class__: AST.Name,
                        name: "_pipe_teststring_0_6"
                    },
                    caseFalse: {
                        __class__: AST.Value,
                        value: 1
                    }
                }
            ]
        });
    });
});
describe("constant folding", () => {
    test("simple math", async () => {
        await expectAST("1 + 2 * 3", {
            __class__: AST.Value,
            value: 7
        });
    });
    test("conditional elimination", async () => {
        await expectAST("1 == 1 ? hello : goodbye", {
            __class__: AST.Name,
            name: "hello"
        });
    });
    test("inner expressions folded", async () => {
        await expectAST("[1+1, 2+2, 2^(1/12)]", {
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
    test("folding with strings", async () => {
        await expectAST("'Hello, ' + 'World!'", {
            __class__: AST.Value,
            value: "Hello, World!"
        });
    });
    test("list splat constant folding", async () => {
        await expectAST("[a, *[b, *[c], d]]", {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Name,
                    name: "a",
                },
                {
                    __class__: AST.Name,
                    name: "b",
                },
                {
                    __class__: AST.Name,
                    name: "c",
                },
                {
                    __class__: AST.Name,
                    name: "d",
                }
            ]
        });
    });
    test("call site constant folding", async () => {
        await expectAST("foo(a, b, *[c, d])", {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Name,
                    name: "a",
                },
                {
                    __class__: AST.Name,
                    name: "b",
                },
                {
                    __class__: AST.Name,
                    name: "c",
                },
                {
                    __class__: AST.Name,
                    name: "d",
                }
            ]
        });
    });
    test("pipe constant folding", async () => {
        await expectAST("100 + 245 |> (# + # + 'abc' + #)", {
            __class__: AST.Value,
            value: "690abc345"
        });
    });
    test("length constant folding for a constant length list", async () => {
        await expectAST("1 |> (#[foo, #bar]+#)", {
            __class__: AST.Value,
            value: 3
        });
    });
    test("length constant folding for a constant length list with splats", async () => {
        await expectAST("1 |> (#[foo, *[1, 2, 3]]+#)", {
            __class__: AST.Value,
            value: 5
        });
    });
    test("no length constant folding for a list with unfoldable splats in it", async () => {
        await expectAST("#[1, *a]", {
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
                            __class__: AST.Name,
                            name: "a"
                        }
                    }
                ]
            }
        });
    });
    test("folding part but not all", async () => {
        await expectAST("#[1, *[*a, 1]]", {
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
                            __class__: AST.Name,
                            name: "a"
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
});
