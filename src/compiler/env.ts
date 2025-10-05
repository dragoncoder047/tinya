import { AST } from "./ast";

export type MacroImpl = [
    name: string,
    argc: number | undefined,
    expand: (call: AST.Call, macroList: MacroImpl[]) => Promise<AST.Node>,
];
