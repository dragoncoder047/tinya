import { AST, ASTCall } from "../parser/ast";

export interface MacroImpl {
    name: string;
    expand(call: ASTCall): Promise<AST>;
}

