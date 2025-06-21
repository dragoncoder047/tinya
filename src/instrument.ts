import type {
    CompiledInstrument,
    NodeImplFactory,
    NodeInstrList,
    NodeTree,
    UsedNodes
} from "./types";
import {
    any,
    getNodeContents,
    getNodeName,
    isArray,
    isConstant,
    isEmpty,
    isInputRef,
    isNode,
    isNodeName,
    isRef,
    isString
} from "./utils";

export const compileInstrument = (tree: NodeTree, nodeTypes: Record<string, NodeImplFactory>): CompiledInstrument => {
    const instructions: NodeInstrList = [];
    const nodes: UsedNodes = [];
    const walk = (node: NodeTree) => {
        const nodeName = getNodeName(node);
        const nodeContents = getNodeContents(node);
        for (var i = 1; i < nodeContents.length; i++) {
            const curEl = nodeContents[i];
            if (isNode(curEl)) {
                walk(curEl);
            } else if (any(curEl, isNodeName, isInputRef, isRef)) {
                instructions.push(curEl);
            } else if (isConstant(curEl)) {
                instructions.push([curEl]);
            }
        }
        // then output the node and register if needed
        instructions.push([nodes.length, nodeContents.length - 1]);
        const [nodeType, nodeArgs] = isArray(nodeContents[0]) && !isEmpty(nodeContents[0]) ? [nodeContents[0][0], nodeContents[0].slice(1)] : [nodeContents[0], []];
        const nodeFactory = (isString(nodeType) && nodeTypes[nodeType]!) || (() => { throw new Error("undefined node type " + nodeType); });
        nodes.push([nodeFactory, nodeArgs]);
        if (nodeName !== undefined) {
            instructions.push(nodeName);
        }
    };
    walk(tree);
    return [instructions, nodes];
};


const INDENT = "|   ";
export const debugDumpInstrument = (instrument: CompiledInstrument, nodeTypes: Record<any, NodeImplFactory>): string => {
    const [instructions, nodeFactories] = instrument;
    const getNodeName = (factory: NodeImplFactory): string => {
        for (var k of Object.keys(nodeTypes)) {
            if (nodeTypes[k] === factory) return k;
        }
        return factory.name || "unknown";
    }
    const nodeNames = nodeFactories.map(([factory, args], index) => `call ${getNodeName(factory)}(${args.join(", ")}) [index ${index}]`);
    const output: string[] = [];
    var i = instructions.length - 1;
    const addLine = (depth: number, line: string) => {
        output.push(`${INDENT.repeat(depth)}${line}`);
    }
    const walk = (depth: number) => {
        if (i < 0) return;
        const inst = instructions[i--]!;
        if (isArray(inst)) {
            if (inst.length === 1) {
                addLine(depth, `push constant ${String(inst[0])}`);
            } else {
                const [nodeIndex, numArgs] = inst;
                addLine(depth, `${nodeNames[nodeIndex]} with ${numArgs}`);
                for (var j = 0; j < numArgs!; j++)
                    walk(depth + 1);
            }
        } else if (isString(inst)) {
            if (isRef(inst)) {
                addLine(depth, `push register ${inst.slice(1)}`);
            } else if (isInputRef(inst)) {
                addLine(depth, `push input channel ${inst.slice(1)}`);
            } else if (isNodeName(inst)) {
                addLine(depth, `store register ${inst.slice(1)}`);
                walk(depth);
            }
        }
    };
    walk(0);
    return output.join("\n") + "\n\n";
}
