import { AST } from "./parser/ast";
declare module "*.preparsed.txt" {
    const value: AST;
    export default value;
}
