import { Node } from "../compiler/ast";
declare module "*.syd" {
    export const ast: Node;
    export const sources: Record<string, string>;
    export default ast;
}
