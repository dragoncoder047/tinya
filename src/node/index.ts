export enum NodeIndex {
    NAME = 0,
    ARGS = 1,
    RETURN = 2,
    ENUMS = 3,
    IMPL = 4,
}
export enum NodeValueType {
    SCALAR,
    STEREO_SCALAR,
    LIST,
}
export type NodeDef = [
    name: string,
    params: [name: string, default_: number | null, type?: NodeValueType][],
    returnType: NodeValueType,
    enumChoices: (Record<string, number> | undefined)[],
    impl: (sampleRate: number) => (args: number[], listArgs: number[]) => number,
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
