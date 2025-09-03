export enum NodeIndex {
    NAME = 0,
    ARGS = 1,
    ENUM = 2,
    FACTORY = 3,
}
export type Node = [
    string,
    [name: string, default_: number][],
    (Record<string, number> | undefined)[],
    // The activityIndicator function will keep this node alive to the next sample when called.
    // It returns true if any of the input nodes are active this sample.
    // Completely passive nodes can just ignore the parameter.
    (sampleRate: number) => (args: Float32Array, active: () => boolean) => number,
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
