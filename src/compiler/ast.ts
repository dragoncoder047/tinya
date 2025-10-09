import { isinstance, str } from "../utils";
import { processArgsInCall } from "./call";
import { makeCodeMacroExpander } from "./codemacro";
import { CompileError, ErrorNote, LocationTrace, RuntimeError } from "./errors";
import { EvalState, NodeValueType } from "./evalState";
import { OPERATORS } from "./operator";
import { allocRegister, allocNode, CompileState, Opcode, Program } from "./prog";

export namespace AST {

    export abstract class Node {
        constructor(public loc: LocationTrace) { }
        abstract edgemost(left: boolean): Node;
        abstract pipe(fn: (node: Node) => Promise<Node>): Promise<Node>;
        abstract eval(state: EvalState): Promise<Node>;
        abstract compile(state: CompileState): void;
    }

    abstract class NotCodeNode extends Node {
        compile(state: CompileState) {
            throw new CompileError("how did we get here ?!?", this.loc);
        }
    }

    abstract class Leaf extends NotCodeNode {
        edgemost() { return this; }
        async pipe() { return this; }
        async eval(_: EvalState): Promise<AST.Node> { return this; }
    }

    export class AnnotatedValue extends NotCodeNode {
        constructor(trace: LocationTrace, public attributes: Node[], public value: Node | null = null) { super(trace); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new AnnotatedValue(this.loc, await asyncNodePipe(this.attributes, fn), this.value ? await fn(this.value) : null); }
        edgemost(left: boolean): Node { return left ? (this.attributes.length > 0 ? this.attributes[0]!.edgemost(left) : this) : (this.value ?? this); }
        async eval(state: EvalState) {
            var v = this.value;
            for (var attr of this.attributes) {
                var args: Node[] | null = null;
                var name: string;
                if (isinstance(attr, Call) || isinstance(attr, Name)) {
                    name = attr.name;
                    const impl = state.annotators[name];
                    if (!impl) {
                        throw new RuntimeError("unknown annotation " + str(name), attr.loc, stackToNotes(state.callstack));
                    }
                    if (isinstance(attr, Call)) {
                        args = attr.args;
                    }
                    v = await impl(v, args, state);
                } else {
                    throw new RuntimeError("illegal annotation", attr.loc, stackToNotes(state.callstack));
                }
            }
            return v!;
        }
    }

    export class Value extends Leaf {
        constructor(trace: LocationTrace, public value: any) { super(trace); };
        async eval(state: EvalState): Promise<Node> {
            if (isinstance(this.value, Node)) return this.value;
            return this;
        }
        compile(state: CompileState) {
            state.p.push(Opcode.PUSH_CONSTANT, this.value);
            state.tosStereo = false;
        }
    }

    export class Symbol extends Leaf {
        constructor(trace: LocationTrace, public value: string) { super(trace); };
        async eval(state: EvalState): Promise<Symbol> {
            return this;
        }
    }

    export class Assignment extends Node {
        constructor(trace: LocationTrace, public name: string, public value: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Assignment(this.loc, this.name, await fn(this.value)); }
        async eval(state: EvalState) {
            const scope = Object.hasOwn(state.env, this.name) ? state.env : Object.hasOwn(state.globalEnv, this.name) ? state.globalEnv : state.env;
            return scope[this.name] = await this.value.eval(state);
        }
        compile(state: CompileState) {
            this.value.compile(state);
            state.p.push(Opcode.TAP_REGISTER, allocRegister(this.name, state));
        }
    }

    export class Name extends Leaf {
        constructor(trace: LocationTrace, public name: string) { super(trace); };
        async eval(state: EvalState) {
            const val = state.env[this.name];
            if (!val) {
                throw new RuntimeError("undefined: " + this.name, this.loc, stackToNotes(state.callstack));
            }
            return val;
        }
        compile(state: CompileState) {
            state.p.push(Opcode.GET_REGISTER, allocRegister(this.name, state));
        }
    }

    export class Call extends Node {
        constructor(trace: LocationTrace, public name: string, public args: Node[]) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Call(this.loc, this.name, await asyncNodePipe(this.args, fn)); }
        async eval(state: EvalState) {
            const funcImpl = state.functions.find(f => f[0] === this.name);
            if (funcImpl) {
                const [name, argc, impl] = funcImpl;
                if ((argc ?? -1) >= 0 && this.args.length !== argc) {
                    throw new RuntimeError(`wrong number of arguments to function ${name} (expected ${argc}, got ${this.args.length})`, this.loc, stackToNotes(state.callstack));
                }
                const newState: EvalState = { ...state, callstack: state.callstack.concat(this) };
                return impl(this.args, newState);
            }
            const nodeImpl = state.nodes.find(n => n[0] === this.name);
            if (!nodeImpl) {
                throw new RuntimeError("undefined node or function " + this.name, this.loc, stackToNotes(state.callstack));
            }
            var x: List;
            if (nodeImpl[2] === NodeValueType.DECOUPLED_MATH && (x = new List(this.loc, this.args)).isImmediate()) {
                return new Value(this.loc, nodeImpl[4]()(null!, x.toImmediate()!));
            }
            return new Call(this.loc, nodeImpl[0], await processArgsInCall(state, true, this.loc, this.args, nodeImpl));
        }
        compile(state: CompileState) {
            var i: number;
            const nodeImpl = state.ni.find(n => n[0] === this.name);
            if (!nodeImpl) {
                throw new CompileError(`cannot find node ${this.name} (should be unreachable!!)`, this.loc);
            }
            const argProgs: [argProg: Program, isStereo: NodeValueType][] = [];
            const existingProg: Program = state.p;
            for (i = 0; i < this.args.length; i++) {
                state.p = [];
                this.args[i]!.compile(state);
                argProgs.push([state.p, state.tosStereo ? NodeValueType.STEREO : NodeValueType.NORMAL_OR_MONO]);
            }
            state.p = existingProg;
            const callProg: Program = [Opcode.APPLY_NODE, allocNode(this.name, state)];
            // logic for stereo/mono nodes:
            // if the node is x -> stereo, the inputs must all be the right type (mono to stereo can be widened; stereo to mono can't be narrowed, error)
            // if the node is mono -> mono, the node itself is duplicated if any inputs are stereo and the output is stereo, else mono
            // if the node is stereo -> mono, normal with the inputs also being widened if needed
            // We assume our arguments are correct and line up positionally already
            // (this should have been handled by the eval() stage)
            state.tosStereo = nodeImpl[2] === NodeValueType.STEREO;
            if (nodeImpl[1].every(a => a[2] !== NodeValueType.STEREO) && argProgs.some(s => s[1] === NodeValueType.STEREO)) {
                // Can stereo widen
                for (i = 0; i < nodeImpl[1].length; i++) {
                    const gottenArgType = argProgs[i]![1];
                    if (gottenArgType !== NodeValueType.STEREO) {
                        argProgs[i]![0].push(Opcode.STEREO_DOUBLE_WIDEN);
                    }
                }
                state.tosStereo = true;
                callProg[0] = Opcode.APPLY_DOUBLE_NODE_STEREO;
                callProg.push(allocNode(this.name, state)); // 2nd node
            }
            else {
                for (i = 0; i < nodeImpl[1].length; i++) {
                    const neededArgType = nodeImpl[1][i]![2]! ?? NodeValueType.NORMAL_OR_MONO;
                    const gottenArgType = argProgs[i]![1];
                    if (neededArgType !== NodeValueType.STEREO && gottenArgType === NodeValueType.STEREO) {
                        throw new CompileError("cannot implicitly convert stereo output to mono", this.args[i]!.loc);
                    } else if (neededArgType === NodeValueType.STEREO && gottenArgType !== NodeValueType.STEREO) {
                        argProgs[i]![0].push(Opcode.STEREO_DOUBLE_WIDEN);
                    }
                }
                state.tosStereo = nodeImpl[2] === NodeValueType.STEREO;
            }
            for (i = 0; i < this.args.length; i++) {
                state.p.push(...argProgs[i]![0]);
            }
            state.p.push(...callProg);
        }
    }

    export class List extends Node {
        constructor(trace: LocationTrace, public values: Node[]) { super(trace); };
        edgemost(left: boolean): Node { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new List(this.loc, await asyncNodePipe(this.values, fn)); }
        async eval(state: EvalState) {
            const values: Node[] = [];
            for (var v of this.values) {
                const v2 = await v.eval(state);
                if (isinstance(v2, SplatValue) && isinstance(v2.value, List)) {
                    values.push(...v2.value.values);
                } else {
                    values.push(v2);
                }
            }
            return new List(this.loc, values);
        }
        hasSplats() {
            return this.values.some(v => isinstance(v, SplatValue));
        }
        isImmediate(): boolean {
            return this.values.every(v => isinstance(v, Value) || (isinstance(v, List) && v.isImmediate()));
        }
        toImmediate(): any[] | undefined {
            if (this.isImmediate()) {
                return this.values.map(v => isinstance(v, Value) ? v.value : (v as List).toImmediate());
            }
        }
        static fromImmediate(trace: LocationTrace, m: any[]): List | Value {
            return Array.isArray(m) ? new List(trace, m.map(r => List.fromImmediate(trace, r))) : new Value(trace, m);
        }
        compile(state: CompileState) {
            if (this.isImmediate()) {
                const imm = this.toImmediate() as any;
                state.p.push(Opcode.PUSH_CONSTANT, imm);
            } else {
                state.p.push(Opcode.PUSH_FRESH_EMPTY_LIST);
                for (var arg of this.values) {
                    if (isinstance(arg, SplatValue)) {
                        arg.value.compile(state);
                        state.p.push(Opcode.EXTEND_TO_LIST);
                    } else {
                        arg.compile(state);
                        state.p.push(Opcode.APPEND_TO_LIST);
                    }
                }
            }
            state.tosStereo = this.values.length === 2;
        }
    }

    export class Definition extends NotCodeNode {
        constructor(trace: LocationTrace, public name: string, public outMacro: boolean, public parameters: Node[], public body: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Definition(this.loc, this.name, this.outMacro, await asyncNodePipe(this.parameters, fn), await fn(this.body)); }
        async eval(state: EvalState) {
            state.functions.push([this.name, this.parameters.length, makeCodeMacroExpander(this.name, this.outMacro, this.parameters, this.body)]);
            return new Value(this.loc, undefined);
        }
    }

    export class ParameterDescriptor extends NotCodeNode {
        constructor(trace: LocationTrace, public name: string, public enumOptions: Mapping, public defaultValue: Node, public lazy: boolean) { super(trace) }
        edgemost(left: boolean): Node { return left ? this : this.defaultValue.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new ParameterDescriptor(this.loc, this.name, await fn(this.enumOptions) as Mapping, await fn(this.defaultValue), this.lazy) }
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class Template extends NotCodeNode {
        constructor(trace: LocationTrace, public result: Node) { super(trace); };
        edgemost(left: boolean): Node { return this.result.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Template(this.loc, await fn(this.result)); }
        async eval(state: EvalState) {
            const replaceTrace = async (arg: Node): Promise<Node> => {
                const val = await arg.pipe(replaceTrace);
                val.loc = new LocationTrace(arg.loc.line, arg.loc.col, arg.loc.file, ["note: expanded from template:", this.loc]);
                return val;
            }
            const recur = async (arg: Node, depth: number): Promise<Node> => {
                if (isinstance(arg, Template)) return arg.pipe(n => recur(n, depth + 1));
                if (isinstance(arg, InterpolatedValue)) {
                    if (depth <= 1) {
                        return replaceTrace(await arg.value.eval(state));
                    } else {
                        const val = await arg.pipe(n => recur(n, depth - 1));
                        if (isinstance(val, InterpolatedValue) && isinstance(val.value, Value)) return val.value;
                        return val;
                    }
                }
                return arg.pipe(n => recur(n, depth));
            }
            return recur(await replaceTrace(this.result), 1);
        }
    }

    export class BinaryOp extends Node {
        constructor(trace: LocationTrace, public op: string, public left: Node, public right: Node, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(trace); };
        edgemost(left: boolean): Node { return this[left ? "left" : "right"].edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new BinaryOp(this.loc, this.op, await fn(this.left), await fn(this.right), this.noLift, this.assign); }
        async eval(state: EvalState) {
            return this._applied(await this.left.eval(state), await this.right.eval(state));
        }
        private _applied(left: Node, right: Node) {
            var fn: (typeof OPERATORS)[keyof typeof OPERATORS]["cb"] | undefined;
            var imm = true, a, b;
            if (isinstance(left, Value)) {
                a = left.value;
            } else if (isinstance(left, List) && left.isImmediate()) {
                a = left.toImmediate();
            } else {
                imm = false;
            }
            if (isinstance(right, Value)) {
                b = right.value;
            } else if (isinstance(right, List) && right.isImmediate()) {
                b = right.toImmediate();
            } else {
                imm = false;
            }
            if ((fn = OPERATORS[this.op]?.cb) && imm) {
                return List.fromImmediate(this.loc, fn(a, b))
            }
            // Special case for comparing in/equality of 2 symbols
            if (isinstance(left, Symbol) && isinstance(right, Symbol) && /^[!=]=$/.test(this.op)) {
                return List.fromImmediate(this.loc, fn!(left.value, b.value));
            }
            return new BinaryOp(this.loc, this.op, left, right);
        }
        compile(state: CompileState) {
            this.left.compile(state);
            this.right.compile(state);
            state.p.push(Opcode.DO_BINARY_OP, this.op);
        }
    }

    export class UnaryOp extends Node {
        constructor(trace: LocationTrace, public op: string, public value: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new UnaryOp(this.loc, this.op, await fn(this.value)); }
        async eval(state: EvalState) {
            return this._applied(await this.value.eval(state));
        }
        private _applied(val: Node): Node {
            var fn: (typeof OPERATORS)[keyof typeof OPERATORS]["cu"] | undefined;
            var imm = true, value;
            if (isinstance(val, Value)) {
                value = val.value;
            } else if (isinstance(val, List) && val.isImmediate()) {
                value = val.toImmediate();
            } else {
                imm = false;
            }
            if (imm && (fn = OPERATORS[this.op]?.cu)) {
                return List.fromImmediate(this.loc, fn(value));
            }
            return new UnaryOp(this.loc, this.op, val);
        }
        compile(state: CompileState) {
            this.value.compile(state);
            state.p.push(Opcode.DO_UNARY_OP, this.op);
        }
    }

    export class DefaultPlaceholder extends Leaf {
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class KeywordArgument extends NotCodeNode {
        constructor(trace: LocationTrace, public name: string, public arg: Node) { super(trace); }
        edgemost(left: boolean): Node { return left ? this : this.arg.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new KeywordArgument(this.loc, this.name, await fn(this.arg)); }
        async eval(state: EvalState) {
            return new KeywordArgument(this.loc, this.name, await this.arg.eval(state));
        }
    }

    export class Mapping extends NotCodeNode {
        constructor(trace: LocationTrace, public mapping: { key: Node, val: Node }[]) { super(trace); }
        edgemost(left: boolean): Node { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Mapping(this.loc, await asyncNodePipe(this.mapping, async ({ key, val }) => ({ key: await fn(key), val: await fn(val) }))); }
        async eval(state: EvalState) { return new Mapping(this.loc, await Promise.all(this.mapping.map(async ({ key, val }) => ({ key: await key.eval(state), val: await val.eval(state) })))); }
        async toJS(state: EvalState): Promise<Record<string, Node>> {
            const out: Record<string, Node> = {};
            for (var { key, val } of this.mapping) {
                if (!isinstance(key, Symbol)) {
                    throw new Error("unreachable");
                }
                out[key.value] = await val.eval(state);
            }
            return out;
        }
    }

    export class Conditional extends Node {
        constructor(trace: LocationTrace, public cond: Node, public caseTrue: Node, public caseFalse: Node) { super(trace); }
        edgemost(left: boolean): Node { return (left ? this.cond : this.caseFalse).edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Conditional(this.loc, await fn(this.cond), await fn(this.caseTrue), await fn(this.caseFalse)); }
        async eval(state: EvalState): Promise<Node> {
            const cond = await this.cond.eval(state);
            if (isinstance(cond, Value)) {
                return (!cond.value ? this.caseFalse : this.caseTrue).eval(state);
            }
            return new Conditional(this.loc, cond, await this.caseTrue.eval(state), await this.caseFalse.eval(state));
        }
        compile(state: CompileState) {
            this.caseFalse.compile(state);
            this.caseTrue.compile(state);
            this.cond.compile(state);
            state.p.push(Opcode.CONDITIONAL_SELECT);
        }
    }

    export class InterpolatedValue extends NotCodeNode {
        constructor(trace: LocationTrace, public value: Node) { super(trace); }
        edgemost(left: boolean): Node { return this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new InterpolatedValue(this.loc, await fn(this.value)); }
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("too many &'s", this.loc, stackToNotes(state.callstack));
        }
    }

    export class SplatValue extends NotCodeNode {
        constructor(trace: LocationTrace, public value: Node) { super(trace); }
        edgemost(left: boolean): Node { return this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new SplatValue(this.loc, await fn(this.value)); }
        async eval(state: EvalState) {
            return new SplatValue(this.loc, await this.value.eval(state));
        }
    }

    export class PipePlaceholder extends Leaf {
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("not valid outside of a pipe expression", this.loc, stackToNotes(state.callstack));
        }
    }

    export class Block extends Node {
        constructor(trace: LocationTrace, public body: Node[]) { super(trace); }
        edgemost(left: boolean): Node { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Block(this.loc, await asyncNodePipe(this.body, fn)); }
        async eval(state: EvalState) {
            var last: Node = new Value(this.loc, undefined);
            for (var v of this.body) {
                if (isinstance(v, DefaultPlaceholder)) last = new Value(v.loc, undefined);
                else last = await v.eval(state);
            }
            return last;
        }
        compile(state: CompileState) {
            for (var arg of this.body) {
                arg.compile(state);
                state.p.push(Opcode.DROP_TOP);
            }
            // *Don't* drop the last value
            state.p.pop();
        }
    }

    async function asyncNodePipe<T>(nodes: T[], fn: (node: T) => Promise<T>): Promise<T[]> {
        return await Promise.all(nodes.map(fn));
    }

    export function stackToNotes(stack: Call[]): ErrorNote[] {
        const out: ErrorNote[] = [];
        for (var s of stack) {
            out.push(new ErrorNote(`note: while evaluating function ${str(s.name)}`, s.loc));
        }
        return out.reverse();
    }

}
