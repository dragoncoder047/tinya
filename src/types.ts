
export type NodeImpl = (sampleNumber: number, ...inputs: number[]) => number;
export type NodeImplFactory = (sampleRate: number, ...args: any[]) => NodeImpl;

export type NodeParameter = null | undefined | string | number | NodeTree;
export type NodeHead = string | [string, ...any];
export type NodeTree = [NodeHead, ...NodeParameter[]] | [NodeName, NodeHead, ...NodeParameter[]];
export type NodeName = `=${string}`; // named node, e.g. =osc1
export type InputRef = `>${string}`; // input channel reference, e.g. >freq
export type Ref = `@${string}`; // register reference, e.g. @osc1
export type ChannelImpl = (sampleNo: number, channelValues?: Record<string, number>) => number;
// ops are:
// 2-pair [N, M] means call node N with M arguments popped from the stack
// 1-tuple [X] means push constant X onto the stack
// strings mean references: = means copy TOS to register, > means push input channel value, . means push register value
export type NodeInstrList = ([number, number] | [any] | NodeName | InputRef | Ref)[];
// factory func and additional args to the factories
export type UsedNodes = ([NodeImplFactory, any[]])[];
// first element is registers for references

export type CompiledInstrument = [NodeInstrList, UsedNodes];
