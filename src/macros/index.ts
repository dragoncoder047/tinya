import { AST } from "../compiler/ast";

export interface MacroImpl {
    name: string;
    expand(call: AST.Call): Promise<AST.Node>;
}
