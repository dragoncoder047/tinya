import {
  MessageCode,
  baseCompileState,
  baseEnv,
  nodeHelp,
  nodes
} from "./chunk-P55TU4U3.js";
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
  Leaf,
  List,
  Mapping,
  Name,
  Node,
  NotCodeNode,
  ParameterDescriptor,
  PipePlaceholder,
  SplatValue,
  Symbol,
  Template,
  UnaryOp,
  Value,
  ast_exports,
  parse,
  stackToNotes
} from "./chunk-G32GKSBF.js";
import {
  CompileError,
  ErrorNote,
  LocationTrace,
  ParseError,
  RuntimeError,
  SydError,
  __name
} from "./chunk-PAJYDYBO.js";

// src/lib/data.syd
var source = /* @__PURE__ */ [
  "// basic control flow stuff",
  "",
  "/** while - repeats body while cond is true */",
  "@while(@cond, @body) :- {",
  "    &cond",
  "        ? (&body, while(&cond, &body))",
  "        : 0",
  "};",
  "",
  "/**",
  " * for - repeats body with var running through min-max",
  " * (equivalent to `for (var = min; var < max; var += step) {body}` in JS)",
  " */",
  "@for(@var, min, max, @body, step=1) :- {",
  "    &var = &min;",
  "    while(&var < &max, (",
  "        &body;",
  "        &var += &step",
  "    ))",
  "};",
  "",
  "/** quotes the expression and does NOT evaluate it - returns the AST node verbatim */",
  "quote(@code) :- code;",
  "",
  "/** forces the code to be expanded in the caller's local scope */",
  "@expand(code) :- code;",
  ""
].join("\n");
var _str0while = "while";
var _str1cond = "cond";
var _str2datasyd = "data.syd";
var _str3body = "body";
var _str4for = "for";
var _str5var = "var";
var _str6min = "min";
var _str7max = "max";
var _str8step = "step";
var _str9 = "<";
var _str10 = "+";
var _str11quote = "quote";
var _str12code = "code";
var _str13expand = "expand";
var ast = new Block(
  new LocationTrace(3, 0, _str2datasyd),
  [
    new Definition(
      new LocationTrace(3, 1, _str2datasyd),
      _str0while,
      true,
      [
        new ParameterDescriptor(
          new LocationTrace(3, 8, _str2datasyd),
          _str1cond,
          new Mapping(
            new LocationTrace(3, 8, _str2datasyd),
            []
          ),
          new DefaultPlaceholder(new LocationTrace(3, 8, _str2datasyd)),
          true
        ),
        new ParameterDescriptor(
          new LocationTrace(3, 15, _str2datasyd),
          _str3body,
          new Mapping(
            new LocationTrace(3, 15, _str2datasyd),
            []
          ),
          new DefaultPlaceholder(new LocationTrace(3, 15, _str2datasyd)),
          true
        )
      ],
      new Template(
        new LocationTrace(3, 24, _str2datasyd),
        new Conditional(
          new LocationTrace(5, 8, _str2datasyd),
          new InterpolatedValue(
            new LocationTrace(4, 4, _str2datasyd),
            new Name(
              new LocationTrace(4, 5, _str2datasyd),
              _str1cond
            )
          ),
          new Block(
            new LocationTrace(5, 12, _str2datasyd),
            [
              new InterpolatedValue(
                new LocationTrace(5, 11, _str2datasyd),
                new Name(
                  new LocationTrace(5, 12, _str2datasyd),
                  _str3body
                )
              ),
              new Call(
                new LocationTrace(5, 18, _str2datasyd),
                _str0while,
                [
                  new InterpolatedValue(
                    new LocationTrace(5, 24, _str2datasyd),
                    new Name(
                      new LocationTrace(5, 25, _str2datasyd),
                      _str1cond
                    )
                  ),
                  new InterpolatedValue(
                    new LocationTrace(5, 31, _str2datasyd),
                    new Name(
                      new LocationTrace(5, 32, _str2datasyd),
                      _str3body
                    )
                  )
                ]
              )
            ]
          ),
          new Value(
            new LocationTrace(6, 10, _str2datasyd),
            0
          )
        )
      )
    ),
    new Definition(
      new LocationTrace(13, 1, _str2datasyd),
      _str4for,
      true,
      [
        new ParameterDescriptor(
          new LocationTrace(13, 6, _str2datasyd),
          _str5var,
          new Mapping(
            new LocationTrace(13, 6, _str2datasyd),
            []
          ),
          new DefaultPlaceholder(new LocationTrace(13, 6, _str2datasyd)),
          true
        ),
        new Name(
          new LocationTrace(13, 11, _str2datasyd),
          _str6min
        ),
        new Name(
          new LocationTrace(13, 16, _str2datasyd),
          _str7max
        ),
        new ParameterDescriptor(
          new LocationTrace(13, 22, _str2datasyd),
          _str3body,
          new Mapping(
            new LocationTrace(13, 22, _str2datasyd),
            []
          ),
          new DefaultPlaceholder(new LocationTrace(13, 22, _str2datasyd)),
          true
        ),
        new ParameterDescriptor(
          new LocationTrace(13, 28, _str2datasyd),
          _str8step,
          new Mapping(
            new LocationTrace(13, 32, _str2datasyd),
            []
          ),
          new Value(
            new LocationTrace(13, 33, _str2datasyd),
            1
          ),
          false
        )
      ],
      new Template(
        new LocationTrace(13, 39, _str2datasyd),
        new Block(
          new LocationTrace(14, 5, _str2datasyd),
          [
            new Assignment(
              new LocationTrace(14, 4, _str2datasyd),
              new InterpolatedValue(
                new LocationTrace(14, 4, _str2datasyd),
                new Name(
                  new LocationTrace(14, 5, _str2datasyd),
                  _str5var
                )
              ),
              new InterpolatedValue(
                new LocationTrace(14, 11, _str2datasyd),
                new Name(
                  new LocationTrace(14, 12, _str2datasyd),
                  _str6min
                )
              )
            ),
            new Call(
              new LocationTrace(15, 4, _str2datasyd),
              _str0while,
              [
                new BinaryOp(
                  new LocationTrace(15, 15, _str2datasyd),
                  _str9,
                  new InterpolatedValue(
                    new LocationTrace(15, 10, _str2datasyd),
                    new Name(
                      new LocationTrace(15, 11, _str2datasyd),
                      _str5var
                    )
                  ),
                  new InterpolatedValue(
                    new LocationTrace(15, 17, _str2datasyd),
                    new Name(
                      new LocationTrace(15, 18, _str2datasyd),
                      _str7max
                    )
                  )
                ),
                new Block(
                  new LocationTrace(16, 9, _str2datasyd),
                  [
                    new InterpolatedValue(
                      new LocationTrace(16, 8, _str2datasyd),
                      new Name(
                        new LocationTrace(16, 9, _str2datasyd),
                        _str3body
                      )
                    ),
                    new Assignment(
                      new LocationTrace(17, 8, _str2datasyd),
                      new InterpolatedValue(
                        new LocationTrace(17, 8, _str2datasyd),
                        new Name(
                          new LocationTrace(17, 9, _str2datasyd),
                          _str5var
                        )
                      ),
                      new BinaryOp(
                        new LocationTrace(17, 13, _str2datasyd),
                        _str10,
                        new InterpolatedValue(
                          new LocationTrace(17, 8, _str2datasyd),
                          new Name(
                            new LocationTrace(17, 9, _str2datasyd),
                            _str5var
                          )
                        ),
                        new InterpolatedValue(
                          new LocationTrace(17, 16, _str2datasyd),
                          new Name(
                            new LocationTrace(17, 17, _str2datasyd),
                            _str8step
                          )
                        )
                      )
                    )
                  ]
                )
              ]
            )
          ]
        )
      )
    ),
    new Definition(
      new LocationTrace(22, 0, _str2datasyd),
      _str11quote,
      false,
      [
        new ParameterDescriptor(
          new LocationTrace(22, 7, _str2datasyd),
          _str12code,
          new Mapping(
            new LocationTrace(22, 7, _str2datasyd),
            []
          ),
          new DefaultPlaceholder(new LocationTrace(22, 7, _str2datasyd)),
          true
        )
      ],
      new Name(
        new LocationTrace(22, 16, _str2datasyd),
        _str12code
      )
    ),
    new Definition(
      new LocationTrace(25, 1, _str2datasyd),
      _str13expand,
      true,
      [
        new Name(
          new LocationTrace(25, 8, _str2datasyd),
          _str12code
        )
      ],
      new Name(
        new LocationTrace(25, 17, _str2datasyd),
        _str12code
      )
    ),
    new DefaultPlaceholder(new LocationTrace(25, 21, _str2datasyd))
  ]
);

// src/index.ts
function initWorklet(context, pathToWorkletScript) {
  if (pathToWorkletScript === void 0) {
    pathToWorkletScript = new URL("./sydWorklet.js", import.meta.url);
  }
  context.audioWorklet.addModule(pathToWorkletScript);
}
__name(initWorklet, "initWorklet");
export {
  ast_exports as AST,
  AnnotatedValue,
  Assignment,
  BinaryOp,
  Block,
  Call,
  CompileError,
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
  MessageCode,
  Name,
  Node,
  NotCodeNode,
  ParameterDescriptor,
  ParseError,
  PipePlaceholder,
  RuntimeError,
  SplatValue,
  SydError,
  Symbol,
  Template,
  UnaryOp,
  Value,
  baseCompileState,
  baseEnv,
  initWorklet,
  ast as lib,
  source as libSrc,
  nodeHelp,
  nodes,
  parse,
  stackToNotes
};
//# sourceMappingURL=index.js.map
