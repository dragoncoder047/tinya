import { test } from "bun:test";
import {
    ASTAnnotatedValue,
    ASTAssignment,
    ASTBinaryOp,
    ASTBlock,
    ASTCall,
    ASTConditional,
    ASTConstant,
    ASTDefaultPlaceholder,
    ASTDefine,
    ASTInterpolation,
    ASTKeywordArg,
    ASTList,
    ASTMapping,
    ASTNameReference,
    ASTParameterDescriptor,
    ASTPipePlaceholder,
    ASTSplatExpression,
    ASTSymbol,
    ASTTemplate,
    ASTUnaryOp
} from "../src/parser/ast";
import { describe } from "node:test";
import { expectAST, expectParseError } from "./astCheck";

describe("parse primitive values", () => {
    test("number", () => {
        expectAST("123.456e+78", {
            __class__: ASTConstant,
            value: 123.456e+78
        });
    });
    test("negative number", () => {
        expectAST("-1", {
            __class__: ASTConstant,
            value: -1
        });
    });
    test("regular string", () => {
        expectAST('"hello!\\nworld!"', {
            __class__: ASTConstant,
            value: "hello!\nworld!"
        });
    });
    test("raw string", () => {
        expectAST("'hello!\\nworld!'", {
            __class__: ASTConstant,
            value: "hello!\\nworld!"
        });
    });
    test("string with escaped quote", () => {
        expectAST('"hello \\"quoted\\" world"', {
            __class__: ASTConstant,
            value: 'hello "quoted" world',
        });
    });
    test("raw string with escaped quote", () => {
        expectAST("'hello \\'quoted\\' world'", {
            __class__: ASTConstant,
            value: "hello 'quoted' world",
        });
    });
    test("Unicode escape", () => {
        expectAST('"\\u{1F914}"', {
            __class__: ASTConstant,
            value: "\u{1F914}"
        });
    });
    test("ignore Unicode escape in raw string", () => {
        expectAST("'\\u{1F914}'", {
            __class__: ASTConstant,
            value: "\\u{1F914}"
        });
    });
    test("symbol", () => {
        expectAST(".foo", {
            __class__: ASTSymbol,
            value: "foo"
        });
    });
    test("variable name", () => {
        expectAST("a", {
            __class__: ASTNameReference,
            name: "a"
        });
    });
});
describe("parse expressions", () => {
    test("implicit operator precedence", () => {
        expectAST("1 + 2 * 3", {
            __class__: ASTBinaryOp,
            op: "+",
            left: {
                __class__: ASTConstant,
                value: 1,
            },
            right: {
                __class__: ASTBinaryOp,
                op: "*",
                left: {
                    __class__: ASTConstant,
                    value: 2,
                },
                right: {
                    __class__: ASTConstant,
                    value: 3,
                }
            }
        });
    });
    test("parens force order", () => {
        expectAST("(1 + 2) * 3", {
            __class__: ASTBinaryOp,
            op: "*",
            left: {
                __class__: ASTBinaryOp,
                op: "+",
                left: {
                    __class__: ASTConstant,
                    value: 1,
                },
                right: {
                    __class__: ASTConstant,
                    value: 2,
                }
            },
            right: {
                __class__: ASTConstant,
                value: 3,
            },
        });
    });
    test("exponentiation is right associative", () => {
        expectAST("2 ^ 3 ^ 4", {
            __class__: ASTBinaryOp,
            op: "^",
            left: {
                __class__: ASTConstant,
                value: 2,
            },
            right: {
                __class__: ASTBinaryOp,
                op: "^",
                left: {
                    __class__: ASTConstant,
                    value: 3,
                },
                right: {
                    __class__: ASTConstant,
                    value: 4,
                }
            }
        });
    });
    test("unary minus comes after exponentiation", () => {
        expectAST("-a ^ x", {
            __class__: ASTUnaryOp,
            op: "-",
            value: {
                __class__: ASTBinaryOp,
                op: "^",
                left: {
                    __class__: ASTNameReference,
                    name: "a",
                },
                right: {
                    __class__: ASTNameReference,
                    name: "x"
                }
            }
        });
    });
    test("unary minus doesn't come after exponentiation with a number", () => {
        expectAST("-1 ^ x", {
            __class__: ASTBinaryOp,
            op: "^",
            left: {
                __class__: ASTConstant,
                value: -1,
            },
            right: {
                __class__: ASTNameReference,
                name: "x"
            }
        });
    });
    test("parses splat form", () => {
        expectAST("foo(*bar())", {
            __class__: ASTCall,
            name: "foo",
            args: [
                {
                    __class__: ASTSplatExpression,
                    value: {
                        __class__: ASTCall,
                        name: "bar",
                        args: []
                    }
                }
            ]
        })
    });
    test("parses matrix multiplication form with correct precedence", () => {
        expectAST("a^t @ b + c", {
            __class__: ASTBinaryOp,
            op: "+",
            left: {
                __class__: ASTBinaryOp,
                op: "@",
                left: {
                    __class__: ASTBinaryOp,
                    op: "^",
                    left: {
                        __class__: ASTNameReference,
                        name: "a"
                    },
                    right: {
                        __class__: ASTNameReference,
                        name: "t"
                    }
                },
                right: {
                    __class__: ASTNameReference,
                    name: "b"
                }
            },
            right: {
                __class__: ASTNameReference,
                name: "c"
            }
        });
    });
    test("no postfix operators", () => {
        expectParseError("1 +", "expected a value after operator");
    });
    test("unmatched parens", () => {
        expectParseError("(abc234(1, 4)", '"(" was never closed');
        expectParseError("[{a: 1, b: 3", '"{" was never closed');
        expectParseError("[1 => 2, 3 => [", '"[" was never closed');
        expectParseError("]:", "stray close paren");
        expectParseError("}:-", "stray close paren");
        expectParseError(":)", "stray close paren");
    });
    test("mismatched parens", () => {
        expectParseError("[a, b)", 'expected "]"');
    });
});
describe("parse assignment statements", () => {
    test("simple assignment", () => {
        expectAST("a = 1", {
            __class__: ASTAssignment,
            name: "a",
            value: {
                __class__: ASTConstant,
                value: 1
            }
        });
    });
    test("compound assignment", () => {
        expectAST("a + = 1", {
            __class__: ASTAssignment,
            name: "a",
            value: {
                __class__: ASTBinaryOp,
                op: "+",
                left: {
                    __class__: ASTNameReference,
                    name: "a"
                },
                right: {
                    __class__: ASTConstant,
                    value: 1
                }
            }
        });
    });
});
describe("parse call", () => {
    test("standard", () => {
        expectAST("foo(1, a)", {
            __class__: ASTCall,
            name: "foo",
            args: [
                {
                    __class__: ASTConstant,
                    value: 1,
                },
                {
                    __class__: ASTNameReference,
                    name: "a"
                }
            ]
        });
    });
    test("with keyword arguments", () => {
        expectAST("foo(1, 2, a: 3, b: 4)", {
            __class__: ASTCall,
            args: [
                {
                    __class__: ASTConstant,
                    value: 1,
                },
                {
                    __class__: ASTConstant,
                    value: 2,
                },
                {
                    __class__: ASTKeywordArg,
                    name: "a",
                    arg: {
                        __class__: ASTConstant,
                        value: 3,
                    }
                },
                {
                    __class__: ASTKeywordArg,
                    name: "b",
                    arg: {
                        __class__: ASTConstant,
                        value: 4,
                    }
                }
            ]
        });
    });
    test("throw error when call has keyword arguments before non-keyword arguments", () => {
        expectParseError("foo(a: 1, 2)", "non-keyword argument follows keyword argument");
    });
});
describe("parse list", () => {
    test("normal list", () => {
        expectAST("[1, a]", {
            __class__: ASTList,
            values: [
                {
                    __class__: ASTConstant,
                    value: 1,
                },
                {
                    __class__: ASTNameReference,
                    name: "a"
                }
            ]
        });
    });
    test("throw error about empty slots in list", () => {
        expectParseError("[1, 2, ]", "illegal trailing comma in list");
        expectParseError("[1, , 2]", "empty elements not allowed in list");
    });
    test("empty list", () => {
        expectAST("[]", {
            __class__: ASTList,
            values: []
        });
    });
});
describe("parse mapping", () => {
    test("parse mapping like a list", () => {
        expectAST("[1 => 2, .foo => .bar]", {
            __class__: ASTMapping,
            mapping: [
                {
                    key: {
                        __class__: ASTConstant,
                        value: 1,
                    },
                    val: {
                        __class__: ASTConstant,
                        value: 2,
                    }
                },
                {
                    key: {
                        __class__: ASTSymbol,
                        value: "foo",
                    },
                    val: {
                        __class__: ASTSymbol,
                        value: "bar",
                    }
                }
            ]
        });
    });
    test('error when not all entries have "=>"', () => {
        expectParseError("[1, 2, 3 => 4]", 'expected "=>" after key value');
        expectParseError("[1 => 2, 3, 4]", 'expected "=>" after key value');
    });
    test("arbitrary expressions as key & value", () => {
        expectAST("[1 + 2 => 3 + 4]", {
            __class__: ASTMapping,
            mapping: [
                {
                    key: {
                        __class__: ASTBinaryOp,
                        op: "+",
                        left: {
                            __class__: ASTConstant,
                            value: 1,
                        },
                        right: {
                            __class__: ASTConstant,
                            value: 2,
                        }
                    },
                    val: {
                        __class__: ASTBinaryOp,
                        op: "+",
                        left: {
                            __class__: ASTConstant,
                            value: 3,
                        },
                        right: {
                            __class__: ASTConstant,
                            value: 4,
                        }
                    }
                }
            ]
        });
    });
});
describe("parse ternary operator", () => {
    test("lift 2 binary operators", () => {
        expectAST("a ? b : c", {
            __class__: ASTConditional,
            cond: {
                __class__: ASTNameReference,
                name: "a",
            },
            caseTrue: {
                __class__: ASTNameReference,
                name: "b",
            },
            caseFalse: {
                __class__: ASTNameReference,
                name: "c",
            }
        });
    });
    test("error when only half present", () => {
        expectParseError("a ? b", 'expected ":" after expression');
        expectParseError("b : c", "named parameter not directly inside a callsite");
    });
});
describe("parse definition", () => {
    test("simple definition", () => {
        expectAST("foo(a, b) :- 1", {
            __class__: ASTDefine,
            name: "foo",
            parameters: [
                {
                    __class__: ASTNameReference,
                    name: "a",
                },
                {
                    __class__: ASTNameReference,
                    name: "b"
                }
            ],
            body: {
                __class__: ASTConstant,
                value: 1,
            }
        });
    });
    test("with defaults", () => {
        expectAST("foo(a, b = 1) :- 1", {
            __class__: ASTDefine,
            name: "foo",
            parameters: [
                {
                    __class__: ASTNameReference,
                    name: "a",
                },
                {
                    __class__: ASTParameterDescriptor,
                    name: "b",
                    defaultValue: {
                        __class__: ASTConstant,
                        value: 1,
                    }
                }
            ],
            body: {
                __class__: ASTConstant,
                value: 1,
            }
        });
    });
});
describe("parse block of commas", () => {
    test("defaults at all but end get trimmed", () => {
        expectAST(",1, ,2, 3,", {
            __class__: ASTBlock,
            body: [
                {
                    __class__: ASTConstant,
                    value: 1,
                },
                {
                    __class__: ASTConstant,
                    value: 2,
                },
                {
                    __class__: ASTConstant,
                    value: 3,
                },
                {
                    __class__: ASTDefaultPlaceholder
                }
            ],
        });
    });
    test("normal commas", () => {
        expectAST("1, 2, 3", {
            __class__: ASTBlock,
            body: [
                {
                    __class__: ASTConstant,
                    value: 1,
                },
                {
                    __class__: ASTConstant,
                    value: 2,
                },
                {
                    __class__: ASTConstant,
                    value: 3,
                }
            ],
        });
    });
});
describe("parse template and interpolation", () => {
    test("single template", () => {
        expectAST("{foo(), bar()}", {
            __class__: ASTTemplate,
            result: {
                __class__: ASTBlock,
                body: [
                    {
                        __class__: ASTCall,
                        name: "foo",
                        args: []
                    },
                    {
                        __class__: ASTCall,
                        name: "bar",
                        args: []
                    },
                ]
            }
        });
    });
    test("template with interpolation", () => {
        expectAST("{foo(), &bar}", {
            __class__: ASTTemplate,
            result: {
                __class__: ASTBlock,
                body: [
                    {
                        __class__: ASTCall,
                        name: "foo",
                        args: []
                    },
                    {
                        __class__: ASTInterpolation,
                        value: {
                            __class__: ASTNameReference,
                            name: "bar"
                        }
                    },
                ]
            }
        });
    })
});

describe("pipeline placeholder", () => {
    test("parses pipe placeholder form", () => {
        expectAST("bar(#, 1, #)", {
            __class__: ASTCall,
            name: "bar",
            args: [
                {
                    __class__: ASTPipePlaceholder,
                },
                {
                    __class__: ASTConstant,
                    value: 1
                },
                {
                    __class__: ASTPipePlaceholder,
                }
            ]
        })
    });
});
describe("parses and attaches attributes", () => {
    test("simple attributes on a definition", () => {
        expectAST("#!preset foo(a, b) :- 1", {
            __class__: ASTAnnotatedValue,
            attributes: [
                {
                    __class__: ASTNameReference,
                    name: "preset"
                }
            ],
            value: {
                __class__: ASTDefine,
                name: "foo",
                parameters: [
                    {
                        __class__: ASTNameReference,
                        name: "a",
                    },
                    {
                        __class__: ASTNameReference,
                        name: "b"
                    }
                ],
                body: {
                    __class__: ASTConstant,
                    value: 1,
                }
            }
        });
    });
    test("complex attribute on a definition", () => {
        expectAST("#!preset('FM Sine') fmSine(a) :- 1", {
            __class__: ASTAnnotatedValue,
            attributes: [
                {
                    __class__: ASTCall,
                    name: "preset",
                    args: [
                        {
                            __class__: ASTConstant,
                            value: "FM Sine"
                        },
                    ]
                }
            ],
            value: {
                __class__: ASTDefine,
                name: "fmSine",
                parameters: [
                    {
                        __class__: ASTNameReference,
                        name: "a",
                    },
                ],
                body: {
                    __class__: ASTConstant,
                    value: 1,
                }
            }
        });
    });
    test("complex attribute 2", () => {
        expectAST("#!preset('FM Sine', category: 'Retro') fmSine(a) :- 1", {
            __class__: ASTAnnotatedValue,
            attributes: [
                {
                    __class__: ASTCall,
                    name: "preset",
                    args: [
                        {
                            __class__: ASTConstant,
                            value: "FM Sine"
                        },
                        {
                            __class__: ASTKeywordArg,
                            name: "category",
                            arg: {
                                __class__: ASTConstant,
                                value: "Retro"
                            }
                        }
                    ]
                }
            ],
            value: {
                __class__: ASTDefine,
                name: "fmSine",
                parameters: [
                    {
                        __class__: ASTNameReference,
                        name: "a",
                    },
                ],
                body: {
                    __class__: ASTConstant,
                    value: 1,
                }
            }
        });
    });
    test("simple attributes as a value in context", () => {
        expectAST("zz(#!pitch) + 1", {
            __class__: ASTBinaryOp,
            op: "+",
            left: {
                __class__: ASTCall,
                name: "zz",
                args: [
                    {
                        __class__: ASTAnnotatedValue,
                        value: null,
                        attributes: [
                            {
                                __class__: ASTNameReference,
                                name: "pitch"
                            }
                        ]
                    }
                ]
            },
            right: {
                __class__: ASTConstant,
                value: 1
            }
        })
    });
    test("complex attributes as a value", () => {
        expectAST("#!mod(0, 1)", {
            __class__: ASTAnnotatedValue,
            attributes: [
                {
                    __class__: ASTCall,
                    name: "mod",
                    args: [
                        {
                            __class__: ASTConstant,
                            value: 0
                        },
                        {
                            __class__: ASTConstant,
                            value: 1
                        }
                    ]
                }
            ],
            value: null
        });
    });
    test("attribute used as value if cannot annotate expression", () => {
        expectAST("#!z + y", {
            __class__: ASTBinaryOp,
            op: "+",
            left: {
                __class__: ASTAnnotatedValue,
                attributes: [
                    {
                        __class__: ASTNameReference,
                        name: "z",
                    }
                ],
                value: null
            },
            right: {
                __class__: ASTNameReference,
                name: "y"
            }
        });
    });
    test("EOF'ed attribute", () => {
        expectParseError("#!", "expected attribute after '#!'")
    });
    test("attribute in invalid location", () => {
        expectParseError("a #!z + y", "expected operator before value");
    });
    test("attribute needs constant arguments", () => {
        expectParseError("#!foo(a + b)", "attribute arguments must all be constants");
    });
});
