export enum NodeIndex {
    NAME = 0,
    ARGS = 1,
    ENUMS = 2,
    FACTORY = 3,
}
// TODO: let nodes have list or stereo sample inputs/return value
export type Node = [
    string,
    [name: string, default_: number][],
    (Record<string, number> | undefined)[],
    (sampleRate: number) => (args: Float32Array) => number,
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
