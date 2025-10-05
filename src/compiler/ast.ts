import { isinstance, str } from "../utils";
import { processArgsInCall } from "./call";
import { makeCodeMacroExpander } from "./codemacro";
import { EvalState } from "./env";
import { ErrorNote, LocationTrace, RuntimeError } from "./errors";
import { OPERATORS } from "./operator";

export namespace AST {

    export abstract class Node {
        constructor(public loc: LocationTrace) { }
        abstract edgemost(left: boolean): Node;
        abstract pipe(fn: (node: Node) => Promise<Node>): Promise<Node>;
        abstract simp(): Node;
        abstract eval(state: EvalState): Promise<Node>;
    }

    class Leaf extends Node {
        edgemost() { return this; }
        async pipe() { return this; }
        simp() { return this; }
        async eval(_: EvalState): Promise<AST.Node> { return this; }
    }

    export class AnnotatedValue extends Node {
        constructor(trace: LocationTrace, public attributes: Node[], public value: Node | null = null) { super(trace); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new AnnotatedValue(this.loc, await asyncNodePipe(this.attributes, fn), this.value ? await fn(this.value) : null); }
        edgemost(left: boolean): Node { return left ? (this.attributes.length > 0 ? this.attributes[0]!.edgemost(left) : this) : (this.value ?? this); }
        simp(): Node { return new AnnotatedValue(this.loc, this.attributes.map(a => a.simp()), this.value?.simp()); }
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
    }

    export class Symbol extends Leaf {
        constructor(trace: LocationTrace, public value: string) { super(trace); };
        async eval(state: EvalState): Promise<AST.Node> {
            const choices = state.currentEnumChoices;
            const value = choices?.[this.value];
            if (value !== undefined) {
                return new Value(this.loc, value);
            }
            throw new RuntimeError(choices ? "cannot evaluate symbol here" : `unknown symbol name ${str(this.value)} for parameter`, this.loc, choices ? [new ErrorNote("note: valid options are: " + Object.keys(choices).join(", "), this.loc)] : []);
        }
    }

    export class Assignment extends Node {
        constructor(trace: LocationTrace, public name: string, public value: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Assignment(this.loc, this.name, await fn(this.value)); }
        simp() { return new Assignment(this.loc, this.name, this.value.simp()); }
        async eval(state: EvalState) {
            return state.env[this.name] = await this.value.eval(state);
        }
    }

    export class Name extends Leaf {
        constructor(trace: LocationTrace, public name: string) { super(trace); };
        async eval(state: EvalState) {
            const val = state.env[this.name];
            if (!val) {
                throw new RuntimeError("undefined: " + str(this.name), this.loc, stackToNotes(state.callstack));
            }
            return val;
        }
    }

    export class Call extends Node {
        constructor(trace: LocationTrace, public name: string, public args: Node[]) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Call(this.loc, this.name, await asyncNodePipe(this.args, fn)); }
        simp(): Node {
            const values = this.args.flatMap(a => {
                const v = a.simp();
                if (isinstance(v, SplatValue) && isinstance(v.value, List)) return v.value.values;
                return [v];
            });
            return new Call(this.loc, this.name, values);
        }
        async eval(state: EvalState) {
            const macroImpl = state.macros.find(m => m[0] === this.name);
            if (macroImpl) {
                const [name, argc, impl] = macroImpl;
                if ((argc ?? -1) >= 0 && this.args.length !== argc) {
                    throw new RuntimeError(`wrong number of arguments to macro ${name} (expected ${argc}, got ${this.args.length})`, this.loc, stackToNotes(state.callstack));
                }
                const newState: EvalState = { ...state, env: Object.create(state.globalEnv), callstack: state.callstack.concat(this) };
                return (await impl(this.args, newState)).eval(state);
            }
            const nodeImpl = state.nodes.find(n => n[0] === this.name);
            if (!nodeImpl) {
                throw new RuntimeError("undefined node or macro " + this.name, this.loc, stackToNotes(state.callstack));
            }
            return new Call(this.loc, nodeImpl[0], await processArgsInCall(state, true, this.loc, this.args, nodeImpl));
        }
    }

    export class List extends Node {
        constructor(trace: LocationTrace, public values: Node[]) { super(trace); };
        edgemost(left: boolean): Node { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new List(this.loc, await asyncNodePipe(this.values, fn)); }
        simp(): Node {
            const values = this.values.flatMap(a => {
                const v = a.simp();
                if (isinstance(v, SplatValue) && isinstance(v.value, List)) return v.value.values;
                return [v];
            });
            return new List(this.loc, values);
        }
        async eval(state: EvalState) {
            const values: Node[] = [];
            for (var v of this.values) {
                const v2 = await v.eval(state);
                if (isinstance(v2, SplatValue)) {
                    if (!isinstance(v2.value, List)) {
                        throw new RuntimeError("can't unpack non-list value using a splat", v.loc, stackToNotes(state.callstack));
                    }
                    values.push(...v2.value.values);
                } else {
                    values.push(v2);
                }
            }
            return new List(this.loc, values);
        }
    }

    export class Definition extends Node {
        constructor(trace: LocationTrace, public name: string, public parameters: Node[], public body: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Definition(this.loc, this.name, await asyncNodePipe(this.parameters, fn), await fn(this.body)); }
        simp(): Node { return new Definition(this.loc, this.name, this.parameters.map(a => a.simp()), this.body.simp()); }
        async eval(state: EvalState) {
            state.macros.push([this.name, this.parameters.length, makeCodeMacroExpander(this.name, this.parameters, this.body)]);
            return new Value(this.loc, undefined);
        }
    }

    export class ParameterDescriptor extends Node {
        constructor(trace: LocationTrace, public name: string, public enumOptions: Mapping, public defaultValue: Node) { super(trace) }
        edgemost(left: boolean): Node { return left ? this : this.defaultValue.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new ParameterDescriptor(this.loc, this.name, await fn(this.enumOptions) as Mapping, await fn(this.defaultValue)) }
        simp(): Node { return new ParameterDescriptor(this.loc, this.name, this.enumOptions.simp() as Mapping, this.defaultValue.simp()); }
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class Template extends Node {
        constructor(trace: LocationTrace, public result: Node) { super(trace); };
        edgemost(left: boolean): Node { return this.result.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Template(this.loc, await fn(this.result)); }
        simp(): Node { return new Template(this.loc, this.result.simp()); }
        async eval(state: EvalState) {
            const recur = async (arg: Node, depth: number): Promise<Node> => {
                if (isinstance(arg, Template)) return arg.pipe(n => recur(n, depth + 1));
                if (isinstance(arg, InterpolatedValue)) return arg.pipe(n => recur(n, depth - 1));
                if (depth === 0) {
                    const val = await arg.eval(state);
                    val.loc = new LocationTrace(val.loc.line, val.loc.col, val.loc.file, ["note: expanded from template:", this.loc]);
                    return val;
                }
                return arg.pipe(n => recur(n, depth));
            }
            return recur(this.result, 1);
        }
    }

    export class BinaryOp extends Node {
        constructor(trace: LocationTrace, public op: string, public left: Node, public right: Node, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(trace); };
        edgemost(left: boolean): Node { return this[left ? "left" : "right"].edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new BinaryOp(this.loc, this.op, await fn(this.left), await fn(this.right), this.noLift, this.assign); }
        simp(): Node {
            return this._applied(this.left.simp(), this.right.simp());
        }
        async eval(state: EvalState) {
            return this._applied(await this.left.eval(state), await this.right.eval(state));
        }
        private _applied(left: Node, right: Node) {
            var fn: (typeof OPERATORS)[keyof typeof OPERATORS]["cb"] | undefined;
            if (isinstance(left, Value) && isinstance(right, Value) && (fn = OPERATORS[this.op]?.cb)) {
                return new Value(this.loc, fn(left.value, right.value));
            }
            return new BinaryOp(this.loc, this.op, left, right);
        }
    }

    export class UnaryOp extends Node {
        constructor(trace: LocationTrace, public op: string, public value: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new UnaryOp(this.loc, this.op, await fn(this.value)); }
        simp(): Node {
            return this._applied(this.value.simp());
        }
        async eval(state: EvalState) {
            return this._applied(await this.value.eval(state));
        }
        private _applied(val: Node): Node {
            var fn: (typeof OPERATORS)[keyof typeof OPERATORS]["cu"] | undefined;
            if (isinstance(val, Value) && (fn = OPERATORS[this.op]?.cu)) {
                return new Value(this.loc, fn(val.value));
            }
            // Special case length of an immediate list
            if (isinstance(val, List) && this.op === "#" && val.values.every(v => !(isinstance(v, SplatValue)))) {
                // TODO: if the list has splats in it this should reduce to num_non_splats + #splats
                return new Value(this.loc, OPERATORS["#"]!.cu!(val.values));
            }
            return new UnaryOp(this.loc, this.op, val);
        }
    }

    export class DefaultPlaceholder extends Leaf {
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class KeywordArgument extends Node {
        constructor(trace: LocationTrace, public name: string, public arg: Node) { super(trace); }
        edgemost(left: boolean): Node { return left ? this : this.arg.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new KeywordArgument(this.loc, this.name, await fn(this.arg)); }
        simp(): Node { return new KeywordArgument(this.loc, this.name, this.arg.simp()); }
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class Mapping extends Node {
        constructor(trace: LocationTrace, public mapping: { key: Node, val: Node }[]) { super(trace); }
        edgemost(left: boolean): Node { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Mapping(this.loc, await asyncNodePipe(this.mapping, async ({ key, val }) => ({ key: await fn(key), val: await fn(val) }))); }
        simp(): Node { return new Mapping(this.loc, this.mapping.map(({ key, val }) => ({ key: key.simp(), val: val.simp() }))); }
        async eval(state: EvalState) { return new Mapping(this.loc, await Promise.all(this.mapping.map(async ({ key, val }) => ({ key: await key.eval(state), val: await val.eval(state) })))); }
    }

    export class Conditional extends Node {
        constructor(trace: LocationTrace, public cond: Node, public caseTrue: Node, public caseFalse: Node) { super(trace); }
        edgemost(left: boolean): Node { return (left ? this.cond : this.caseFalse).edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Conditional(this.loc, await fn(this.cond), await fn(this.caseTrue), await fn(this.caseFalse)); }
        simp(): Node {
            const cond = this.cond.simp();
            if (isinstance(cond, Value)) {
                return (!cond.value ? this.caseFalse : this.caseTrue).simp();
            }
            return new Conditional(this.loc, cond, this.caseTrue.simp(), this.caseFalse.simp());
        }
        async eval(state: EvalState): Promise<Node> {
            const cond = await this.cond.eval(state);
            if (isinstance(cond, Value)) {
                return (!cond.value ? this.caseFalse : this.caseTrue).eval(state);
            }
            return new Conditional(this.loc, cond, await this.caseTrue.eval(state), await this.caseFalse.eval(state));
        }
    }

    export class InterpolatedValue extends Node {
        constructor(trace: LocationTrace, public value: Node) { super(trace); }
        edgemost(left: boolean): Node { return this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new InterpolatedValue(this.loc, await fn(this.value)); }
        simp(): Node { return new InterpolatedValue(this.loc, this.value.simp()); }
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class SplatValue extends Node {
        constructor(trace: LocationTrace, public value: Node) { super(trace); }
        edgemost(left: boolean): Node { return this.value.edgemost(left); }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new SplatValue(this.loc, await fn(this.value)); }
        simp(): Node { return new SplatValue(this.loc, this.value.simp()); }
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class PipePlaceholder extends Leaf {
        async eval(state: EvalState): Promise<never> {
            throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
        }
    }

    export class Block extends Node {
        constructor(trace: LocationTrace, public body: Node[]) { super(trace); }
        edgemost(left: boolean): Node { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
        async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Block(this.loc, await asyncNodePipe(this.body, fn)); }
        simp(): Node { return new Block(this.loc, this.body.map(a => a.simp())); }
        async eval(state: EvalState) {
            var last: Node = new Value(this.loc, undefined);
            for (var v of this.body) {
                if (isinstance(v, DefaultPlaceholder)) last = new Value(v.loc, undefined);
                else last = await v.eval(state);
            }
            return last;
        }
    }

    async function asyncNodePipe<T>(nodes: T[], fn: (node: T) => Promise<T>): Promise<T[]> {
        return await Promise.all(nodes.map(fn));
    }

    export function stackToNotes(stack: Call[]): ErrorNote[] {
        const out: ErrorNote[] = [];
        for (var s of stack) {
            out.push(new ErrorNote(`note: while evaluating macro ${str(s.name)}`, s.loc));
        }
        return out.reverse();
    }

}
