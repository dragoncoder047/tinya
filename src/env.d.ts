import { Node } from "./compiler/ast";
declare module "*.syd" {
    export const ast: Node;
    export const source: string;
    export default ast;
}
