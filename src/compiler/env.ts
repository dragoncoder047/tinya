import { AST } from "./ast";

export interface EvalState {
    env: Record<string, AST.Node>;
    globalEnv: Record<string, AST.Node>;
    macros: MacroDef[];
    nodes: NodeDef[];
    callstack: AST.Call[],
    annotators: Record<string, (
        val: AST.Node | null,
        evaledArgs: AST.Node[] | null,
        state: EvalState,
    ) => Promise<AST.Node>>;
}

export type MacroDef = [
    name: string,
    argc: number | undefined,
    expand: (args: AST.Node[], state: EvalState) => Promise<AST.Node>,
];

export enum NodeValueType {
    NORMAL,
    STEREO,
}
export type NodeDef = [
    name: string,
    params: [name: string, default_: number | null, type?: NodeValueType][],
    returnType: NodeValueType,
    enumChoices: (Record<string, number> | undefined)[],
    impl: () => (dt: number, args: number[]) => number,
];

export type NodeHelp = {
    description: string;
    parameters: Record<string, {
        range?: [number, number, step?: number],
        allowNonEnum?: boolean,
        unit?: string,
        description?: string,
    }>;
};
