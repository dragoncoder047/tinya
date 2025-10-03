import { AST } from "./compiler/ast";
declare module "*.preparsed.txt" {
    const value: AST.Node;
    export default value;
}
