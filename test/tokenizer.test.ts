import { expect, test } from "bun:test";
import { LocationTrace } from "../src/parser/errors";
import { tokenize, TokenType } from "../src/parser/tokenizer";

const F = "<TEST>";

test("discards whitespace", () => {
    expect(tokenize("a+b", F).map(t => [t.k, t.t])).toEqual(tokenize("    a   \n +      b\n        ", F).map(t => [t.k, t.t]));
});
test("removes comments", () => {
    expect(tokenize("// foo", F)).toBeArrayOfSize(0);
    expect(tokenize("/* foo */", F)).toBeArrayOfSize(0);
});
test("block comments nest", () => {
    expect(tokenize("/* baz /* foo */ bar */", F)).toBeArrayOfSize(0);
});
test("parses names", () => {
    expect(tokenize("a b coffee", F).map(t => t.t)).toEqual(["a", "b", "coffee"]);
});
test("maintains column and line", () => {
    expect(tokenize("a\nb c", F).map(t => t.s)).toEqual([new LocationTrace(0, 0, F), new LocationTrace(1, 0, F), new LocationTrace(1, 2, F)]);
});
test("parses string with escapes", () => {
    expect(tokenize('"abc\\xFF123"', F).map(t => t.k)).toContain(TokenType.STRING_ESC);
});
test("parses unicode escapes", () => {
    expect(tokenize('"\\u{1F914}"', F).map(t => [t.k, t.t])).toEqual([
        [TokenType.STRING_BEGIN, '"'],
        [TokenType.STRING_ESC, "\\u{1F914}"],
        [TokenType.STRING_END, '"'],
    ]);
})
test("complains on unknown token", () => {
    expect(() => tokenize("$", F)).toThrow('unexpected "$"');
});
