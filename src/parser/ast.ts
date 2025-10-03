import { OPERATORS } from "../operators";
import { LocationTrace } from "./errors";

export namespace AST {

    export abstract class Node {
        constructor(public loc: LocationTrace) { }
        abstract edgemost(left: boolean): Node;
        abstract pipe(fn: (node: Node) => Node): Node;
        abstract simp(): Node;
    }

    class Leaf extends Node {
        edgemost() { return this; }
        pipe() { return this; }
        simp(): Node { return this; }
    }

    export class AnnotatedValue extends Node {
        constructor(trace: LocationTrace, public attributes: Node[], public value: Node | null = null) { super(trace); }
        pipe(fn: (node: Node) => Node): Node { return new AnnotatedValue(this.loc, this.attributes.map(fn), this.value ? fn(this.value) : null); }
        edgemost(left: boolean): Node { return left ? (this.attributes.length > 0 ? this.attributes[0]!.edgemost(left) : this) : (this.value ?? this); }
        simp(): Node { return new AnnotatedValue(this.loc, this.attributes.map(a => a.simp()), this.value?.simp()); }
    }

    export class Constant extends Leaf {
        constructor(trace: LocationTrace, public value: number | string) { super(trace); };
    }

    export class Symbol extends Leaf {
        constructor(trace: LocationTrace, public value: string) { super(trace); };
    }

    export class Assignment extends Node {
        constructor(trace: LocationTrace, public name: string, public value: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new Assignment(this.loc, this.name, fn(this.value)); }
        simp() { return new Assignment(this.loc, this.name, this.value.simp()); }
    }

    export class Name extends Leaf {
        constructor(trace: LocationTrace, public name: string) { super(trace); };
    }

    export class Call extends Node {
        constructor(trace: LocationTrace, public name: string, public args: Node[]) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
        pipe(fn: (node: Node) => Node) { return new Call(this.loc, this.name, this.args.map(fn)); }
        simp(): Node { return new Call(this.loc, this.name, this.args.map(a => a.simp())); }
    }

    export class List extends Node {
        constructor(trace: LocationTrace, public values: Node[]) { super(trace); };
        edgemost(left: boolean): Node { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
        pipe(fn: (node: Node) => Node) { return new List(this.loc, this.values.map(fn)); }
        simp(): Node {
            const values = this.values.flatMap(a => {
                const v = a.simp();
                if (v instanceof SplatValue && v.value instanceof List) return v.value.values;
                return [v];
            });
            return new List(this.loc, values);
        }
    }

    export class Definition extends Node {
        constructor(trace: LocationTrace, public name: string, public parameters: Node[], public body: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new Definition(this.loc, this.name, this.parameters.map(fn), fn(this.body)); }
        simp(): Node { return new Definition(this.loc, this.name, this.parameters.map(a => a.simp()), this.body.simp()); }

    }

    export class ParameterDescriptor extends Node {
        constructor(trace: LocationTrace, public name: string, public enumOptions: Node, public defaultValue: Node) { super(trace) }
        edgemost(left: boolean): Node { return left ? this : this.defaultValue.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new ParameterDescriptor(this.loc, this.name, fn(this.enumOptions), fn(this.defaultValue)) }
        simp(): Node { return new ParameterDescriptor(this.loc, this.name, this.enumOptions.simp(), this.defaultValue.simp()); }
    }

    export class Template extends Node {
        constructor(trace: LocationTrace, public result: Node) { super(trace); };
        edgemost(left: boolean): Node { return this.result.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new Template(this.loc, fn(this.result)); }
        simp(): Node { return new Template(this.loc, this.result.simp()); }
    }

    export class BinaryOp extends Node {
        constructor(trace: LocationTrace, public op: string, public left: Node, public right: Node, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(trace); };
        edgemost(left: boolean): Node { return this[left ? "left" : "right"].edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new BinaryOp(this.loc, this.op, fn(this.left), fn(this.right), this.noLift, this.assign); }
        simp(): Node {
            const left = this.left.simp();
            const right = this.right.simp();
            var fn: ((a: any, b: any) => any) | null | undefined;
            if (left instanceof Constant && right instanceof Constant && (fn = OPERATORS[this.op]?.cb)) {
                return new Constant(this.loc, fn(left.value, right.value));
            }
            return new BinaryOp(this.loc, this.op, left, right);
        }
    }

    export class UnaryOp extends Node {
        constructor(trace: LocationTrace, public op: string, public value: Node) { super(trace); };
        edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new UnaryOp(this.loc, this.op, fn(this.value)); }
        simp(): Node {
            const val = this.value.simp();
            var fn: ((a: any) => any) | null | undefined;
            if (val instanceof Constant && (fn = OPERATORS[this.op]?.cu)) {
                return new Constant(this.loc, fn(val.value));
            }
            return new UnaryOp(this.loc, this.op, val);
        }
    }

    export class DefaultPlaceholder extends Leaf {
    }

    export class KeywordArgument extends Node {
        constructor(trace: LocationTrace, public name: string, public arg: Node) { super(trace); }
        edgemost(left: boolean): Node { return left ? this : this.arg.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new KeywordArgument(this.loc, this.name, fn(this.arg)); }
        simp(): Node { return new KeywordArgument(this.loc, this.name, this.arg.simp()); }
    }

    export class Mapping extends Node {
        constructor(trace: LocationTrace, public mapping: { key: Node, val: Node }[]) { super(trace); }
        edgemost(left: boolean): Node { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
        pipe(fn: (node: Node) => Node) { return new Mapping(this.loc, this.mapping.map(({ key, val }) => ({ key: fn(key), val: fn(val) }))); }
        simp(): Node { return new Mapping(this.loc, this.mapping.map(({ key, val }) => ({ key: key.simp(), val: val.simp() }))); }
    }

    export class Conditional extends Node {
        constructor(trace: LocationTrace, public cond: Node, public caseTrue: Node, public caseFalse: Node) { super(trace); }
        edgemost(left: boolean): Node { return (left ? this.cond : this.caseFalse).edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new Conditional(this.loc, fn(this.cond), fn(this.caseTrue), fn(this.caseFalse)); }
        simp(): Node {
            const cond = this.cond.simp();
            if (cond instanceof Constant) {
                return (!cond.value ? this.caseFalse : this.caseTrue).simp();
            }
            return new Conditional(this.loc, cond, this.caseTrue.simp(), this.caseFalse.simp());
        }
    }

    export class InterpolatedValue extends Node {
        constructor(trace: LocationTrace, public value: Node) { super(trace); }
        edgemost(left: boolean): Node { return this.value.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new InterpolatedValue(this.loc, fn(this.value)); }
        simp(): Node { return new InterpolatedValue(this.loc, this.value.simp()); }
    }

    export class SplatValue extends Node {
        constructor(trace: LocationTrace, public value: Node) { super(trace); }
        edgemost(left: boolean): Node { return this.value.edgemost(left); }
        pipe(fn: (node: Node) => Node) { return new SplatValue(this.loc, fn(this.value)); }
        simp(): Node { return new SplatValue(this.loc, this.value.simp()); }
    }

    export class PipePlaceholder extends Leaf {
    }

    export class Block extends Node {
        constructor(trace: LocationTrace, public body: Node[]) { super(trace); }
        edgemost(left: boolean): Node { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
        pipe(fn: (node: Node) => Node) { return new Block(this.loc, this.body.map(fn)); }
        simp(): Node { return new Block(this.loc, this.body.map(a => a.simp())); }
    }

}
