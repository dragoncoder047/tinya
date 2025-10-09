import { AST } from "./compiler/ast";
declare module "*.syd" {
    const value: AST.Node;
    export default value;
}
