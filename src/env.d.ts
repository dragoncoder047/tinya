import { AST } from "./compiler/ast";
declare module "*.syd" {
    export const ast: AST.Node;
    export const source: string;
    export default ast;
}
