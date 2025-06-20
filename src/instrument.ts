import type {
    CompiledInstrument,
    NodeImpl,
    NodeImplFactory,
    NodeInstrList,
    NodeTree,
    UsedNodes
} from "./types";
import {
    any,
    constant,
    isArray,
    isConstant,
    isEmpty,
    isInputRef,
    isNode,
    isNotNegative,
    isNull,
    isNumber,
    isRef,
    isString,
    isUndefined
} from "./utils";


const isValidPath = (tree: NodeTree, path: number[]): boolean => {
    for (var p of path) {
        const next = tree[p];
        if (any(next, isConstant, isRef, isInputRef, isString)) {
            return false;
        }
        tree = next;
    }
    return true;
};

const absPath = (relPath: number[], currentPath: number[]) => {
    const back = relPath[0]!;
    const path = back < 0 ? relPath.slice(1) : relPath;
    return [currentPath.slice(0, back).concat(path), path];
};

const findReferencedNodes = (node: NodeTree, parents: NodeTree[], currentPath: number[]): number[][] => {
    const references: number[][] = [];
    const nextParents = parents.concat([node]);
    for (var i = 1; i < node.length; i++) {
        const curEl = node[i];
        if (isRef(curEl)) {
            const bottom = curEl[0] < 0 ? parents.at(curEl[0]) : node;
            const [abs, path] = absPath(curEl, currentPath);
            if (!bottom || !isValidPath(bottom, path!)) {
                // not valid -> silently reset to default
                node[i] = undefined;
            } else {
                references.push(abs!);
            }
        }
        if (isNode(curEl)) {
            const nextPath = currentPath.concat(i);
            references.push(...findReferencedNodes(curEl, nextParents, nextPath));
        }
    }
    return references;
};

export const compileInstrument = <T extends string>(tree: NodeTree<T>, nodeTypes: Record<T, NodeImplFactory>): CompiledInstrument => {
    const registers: number[] = [];
    const registerPaths: string[] = [];
    const instructions: NodeInstrList = [];
    const nodes: UsedNodes = [];
    const referencedPaths = new Set(findReferencedNodes(tree, [], []).map(p => p.join(",")));
    const pathReferenced = (p: number[]) => referencedPaths.has(p.join(","));
    const constantsValues: Record<number | string, number> = {};
    const const_ = (c: number | null | undefined): [number, number] => {
        var which = constantsValues[String(c)];
        if (which === undefined) {
            which = nodes.length;
            const node = [constant, [c]] as [NodeImplFactory, number[]];
            nodes.push(node);
            constantsValues[String(c)] = which;
        } else {
        }
        return [which, 0];
    };
    const regPath = (p: number[]) => {
        var index = registerPaths.indexOf(p.join(","));
        if (index === -1) {
            // reffing a node after self
            index = registers.length;
            registers.push(0);
            registerPaths.push(p.join(","));
        }
        return index;
    };
    const walk = (node: NodeTree<T>, parents: NodeTree<T>[], currentPath: number[]) => {
        const nextParents = parents.concat([node]);
        for (var i = 1; i < node.length; i++) {
            const curEl = node[i];
            if (isNode(curEl)) {
                walk(curEl, nextParents, currentPath.concat(i));
            } else if (isConstant(curEl)) {
                instructions.push(const_(curEl));
            } else if (isInputRef(curEl)) {
                instructions.push([curEl[1]]);
            } else if (isRef(curEl)) {
                const [abs, _] = absPath(curEl, currentPath);
                instructions.push(-regPath(abs!));
            }
        }
        // then output the node and register if needed
        instructions.push([nodes.length, node.length - 1]);
        const [nodeName, nodeArgs] = isArray(node[0]) && !isEmpty(node[0]) ? [node[0][0], node[0].slice(1)] : [node[0], []];
        const nodeFactory = isString(nodeName)
            ? nodeTypes[nodeName]!
            : isUndefined(nodeName) || isNull(nodeName)
                ? getAvgMixer(node.length - 1)
                : isArray(nodeName) && isEmpty(nodeName)
                    ? getGainMixer(node.length - 1)
                    : (() => { throw new Error("undefined node type " + nodeName); });
        nodes.push([nodeFactory, nodeArgs]);
        if (pathReferenced(currentPath)) {
            instructions.push(regPath(currentPath));
        }
    };
    walk(tree, [], []);
    return [registers, instructions, nodes];
};
// this may be premature optimization but whatever
const constant_zero: () => NodeImpl = () => () => 0;
const identity_mixer: () => NodeImpl = () => (_, s0) => s0;
const avgMixer_2: () => NodeImpl = () => (_, s0, s1) => (s0 + s1) / 2;
const avgMixer_3: () => NodeImpl = () => (_, s0, s1, s2) => (s0 + s1 + s2) / 3;
const avgMixer_4: () => NodeImpl = () => (_, s0, s1, s2, s3) => (s0 + s1 + s2 + s3) / 4;
const avgMixer_5: () => NodeImpl = () => (_, s0, s1, s2, s3, s4) => (s0 + s1 + s2 + s3 + s4) / 5;
const avgMixer_va: () => NodeImpl = () => (_, ...args) => args.reduce((a, b) => a + b, 0) / args.length;
const getAvgMixer = (n: number): NodeImplFactory => [constant_zero, identity_mixer, avgMixer_2, avgMixer_3, avgMixer_4, avgMixer_5][n] ?? avgMixer_va;
const gainMixer_2: () => NodeImpl = () => (_, s0, s1) => s0 * s1;
const gainMixer_3: () => NodeImpl = () => (_, s0, s1, s2) => s0 * s1 * s2;
const gainMixer_4: () => NodeImpl = () => (_, s0, s1, s2, s3) => s0 * s1 * s2 * s3;
const gainMixer_5: () => NodeImpl = () => (_, s0, s1, s2, s3, s4) => s0 * s1 * s2 * s3 * s4;
const gainMixer_va: () => NodeImpl = () => (_, ...args) => args.reduce((a, b) => a * b, 1);
const getGainMixer = (n: number): NodeImplFactory => [constant_zero, identity_mixer, gainMixer_2, gainMixer_3, gainMixer_4, gainMixer_5][n] ?? gainMixer_va;

const INDENT = "|   ";
export const debugDumpInstrument = (instrument: CompiledInstrument, nodeTypes: Record<any, NodeImplFactory>): string => {
    const [_, instructions, nodeFactories] = instrument;
    nodeTypes = Object.assign({
        __constant: constant,
        __identity_mixer: identity_mixer,
        __avgMixer_2: avgMixer_2,
        __avgMixer_3: avgMixer_3,
        __avgMixer_4: avgMixer_4,
        __avgMixer_5: avgMixer_5,
        __avgMixer_va: avgMixer_va,
        __gainMixer_2: gainMixer_2,
        __gainMixer_3: gainMixer_3,
        __gainMixer_4: gainMixer_4,
        __gainMixer_5: gainMixer_5,
        __gainMixer_va: gainMixer_va
    }, nodeTypes);
    const getNodeName = (factory: NodeImplFactory): string => {
        for (var k of Object.keys(nodeTypes)) {
            if (nodeTypes[k] === factory) return k;
        }
        return factory.name || "unknown";
    }
    const nodeNames = nodeFactories.map(([factory, args], index) => `call ${getNodeName(factory)}(${args.join(", ")}) [index ${index}]`);
    const output: string[] = [];
    var i = instructions.length - 1;
    const walk = (depth: number) => {
        if (i < 0) return;
        const inst = instructions[i--]!;
        if (isArray(inst)) {
            const [nodeIndex, numArgs] = inst;
            const nodeName = isNotNegative(nodeIndex) ? `${nodeNames[nodeIndex]} with ${numArgs}` : `get input channel ${-nodeIndex}`;
            output.push(INDENT.repeat(depth) + nodeName);
            if (isNotNegative(nodeIndex))
                for (var j = 0; j < numArgs!; j++)
                    walk(depth + 1);
        } else if (isNumber(inst)) {
            output.push(`${INDENT.repeat(depth)}${isNotNegative(inst) ? "store" : "get"} register ${inst}`);
        }
    };
    walk(0);
    return output.join("\n") + "\n\n";
};