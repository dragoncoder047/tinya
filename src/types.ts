
export type NodeImpl = (sampleNumber: number, ...inputs: number[]) => number;
export type NodeImplFactory = (sampleRate: number, ...args: number[]) => NodeImpl;

export type NodeParameter<T extends string = any> = null | undefined | [] | number | NodeTree<T>;
export type NodeHead<T extends string = any> = T | null | undefined | [] | [T, ...any[]];
export type NodeTree<T extends string = any> = [NodeHead<T>, ...NodeParameter<T>[]];
export type NodeTreeMacros<T extends string, M extends string> = [M, ...any[]] | [NodeHead<T>, ...(NodeTreeMacros<T, M> | NodeParameter<T>)[]];
// ops are:
// number = (>0 store TOS in register N, <0 push register -N to stack)
// tuple [N, P?] = (N>0 call node N with P args from stack and push result, N<0 get -Nth input and push)
export type NodeInstrList = (number | [number, number] | [number])[];
// factory func and additional args to the factories
export type UsedNodes = ([NodeImplFactory, any[]])[];
// first element is registers for references

export type CompiledInstrument = [number[], NodeInstrList, UsedNodes];
