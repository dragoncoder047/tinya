import { OPERATORS } from "../operators";
import { LocationTrace } from "./errors";

export abstract class AST {
    constructor(public location: LocationTrace) { }
    abstract edgemost(left: boolean): AST;
    abstract pipe(fn: (node: AST) => AST): AST;
    abstract constantFold(): AST;
}

class ASTLeaf extends AST {
    edgemost() { return this; }
    pipe() { return this; }
    constantFold(): AST { return this; }
}

export class ASTAnnotatedValue extends AST {
    constructor(trace: LocationTrace, public attributes: AST[], public value: AST | null = null) { super(trace); }
    pipe(fn: (node: AST) => AST): AST { return new ASTAnnotatedValue(this.location, this.attributes.map(fn), this.value ? fn(this.value) : null); }
    edgemost(left: boolean): AST { return left ? (this.attributes.length > 0 ? this.attributes[0]!.edgemost(left) : this) : (this.value ?? this); }
    constantFold(): AST { return new ASTAnnotatedValue(this.location, this.attributes.map(a => a.constantFold()), this.value?.constantFold()); }
}

export class ASTConstant extends ASTLeaf {
    constructor(trace: LocationTrace, public value: number | string) { super(trace); };
}

export class ASTSymbol extends ASTLeaf {
    constructor(trace: LocationTrace, public value: string) { super(trace); };
}

export class ASTAssignment extends AST {
    constructor(trace: LocationTrace, public name: string, public value: AST) { super(trace); };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTAssignment(this.location, this.name, fn(this.value)); }
    constantFold() { return new ASTAssignment(this.location, this.name, this.value.constantFold()); }
}

export class ASTNameReference extends ASTLeaf {
    constructor(trace: LocationTrace, public name: string) { super(trace); };
}

export class ASTCall extends AST {
    constructor(trace: LocationTrace, public name: string, public args: AST[]) { super(trace); };
    edgemost(left: boolean): AST { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
    pipe(fn: (node: AST) => AST) { return new ASTCall(this.location, this.name, this.args.map(fn)); }
    constantFold(): AST { return new ASTCall(this.location, this.name, this.args.map(a => a.constantFold())); }
}

export class ASTList extends AST {
    constructor(trace: LocationTrace, public values: AST[]) { super(trace); };
    edgemost(left: boolean): AST { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
    pipe(fn: (node: AST) => AST) { return new ASTList(this.location, this.values.map(fn)); }
    constantFold(): AST {
        const values = this.values.flatMap(a => {
            const v = a.constantFold();
            if (v instanceof ASTSplatExpression && v.value instanceof ASTList) return v.value.values;
            return [v];
        });
        return new ASTList(this.location, values);
    }
}

export class ASTDefine extends AST {

    constructor(trace: LocationTrace, public name: string, public parameters: AST[], public body: AST) { super(trace); };
    edgemost(left: boolean): AST { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTDefine(this.location, this.name, this.parameters.map(fn), fn(this.body)); }
    constantFold(): AST { return new ASTDefine(this.location, this.name, this.parameters.map(a => a.constantFold()), this.body.constantFold()); }

}

export class ASTParameterDescriptor extends AST {
    constructor(trace: LocationTrace, public name: string, public enumOptions: AST, public defaultValue: AST) { super(trace) }
    edgemost(left: boolean): AST { return left ? this : this.defaultValue.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTParameterDescriptor(this.location, this.name, fn(this.enumOptions), fn(this.defaultValue)) }
    constantFold(): AST { return new ASTParameterDescriptor(this.location, this.name, this.enumOptions.constantFold(), this.defaultValue.constantFold()); }
}

export class ASTTemplate extends AST {
    constructor(trace: LocationTrace, public result: AST) { super(trace); };
    edgemost(left: boolean): AST { return this.result.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTTemplate(this.location, fn(this.result)); }
    constantFold(): AST { return new ASTTemplate(this.location, this.result.constantFold()); }
}

export class ASTBinaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public left: AST, public right: AST, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(trace); };
    edgemost(left: boolean): AST { return this[left ? "left" : "right"].edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTBinaryOp(this.location, this.op, fn(this.left), fn(this.right), this.noLift, this.assign); }
    constantFold(): AST {
        const left = this.left.constantFold();
        const right = this.right.constantFold();
        var fn: ((a: any, b: any) => any) | null | undefined;
        if (left instanceof ASTConstant && right instanceof ASTConstant && (fn = OPERATORS[this.op]?.cb)) {
            return new ASTConstant(this.location, fn(left.value, right.value));
        }
        return new ASTBinaryOp(this.location, this.op, left, right);
    }
}

export class ASTUnaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public value: AST) { super(trace); };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTUnaryOp(this.location, this.op, fn(this.value)); }
    constantFold(): AST {
        const val = this.value.constantFold();
        var fn: ((a: any) => any) | null | undefined;
        if (val instanceof ASTConstant && (fn = OPERATORS[this.op]?.cu)) {
            return new ASTConstant(this.location, fn(val.value));
        }
        return new ASTUnaryOp(this.location, this.op, val);
    }
}

export class ASTDefaultPlaceholder extends ASTLeaf {
}

export class ASTKeywordArg extends AST {
    constructor(trace: LocationTrace, public name: string, public arg: AST) { super(trace); }
    edgemost(left: boolean): AST { return left ? this : this.arg.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTKeywordArg(this.location, this.name, fn(this.arg)); }
    constantFold(): AST { return new ASTKeywordArg(this.location, this.name, this.arg.constantFold()); }
}

export class ASTMapping extends AST {
    constructor(trace: LocationTrace, public mapping: { key: AST, val: AST }[]) { super(trace); }
    edgemost(left: boolean): AST { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
    pipe(fn: (node: AST) => AST) { return new ASTMapping(this.location, this.mapping.map(({ key, val }) => ({ key: fn(key), val: fn(val) }))); }
    constantFold(): AST { return new ASTMapping(this.location, this.mapping.map(({ key, val }) => ({ key: key.constantFold(), val: val.constantFold() }))); }
}

export class ASTConditional extends AST {
    constructor(trace: LocationTrace, public cond: AST, public caseTrue: AST, public caseFalse: AST) { super(trace); }
    edgemost(left: boolean): AST { return (left ? this.cond : this.caseFalse).edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTConditional(this.location, fn(this.cond), fn(this.caseTrue), fn(this.caseFalse)); }
    constantFold(): AST {
        const cond = this.cond.constantFold();
        if (cond instanceof ASTConstant) {
            return (!cond.value ? this.caseFalse : this.caseTrue).constantFold();
        }
        return new ASTConditional(this.location, cond, this.caseTrue.constantFold(), this.caseFalse.constantFold());
    }
}

export class ASTInterpolation extends AST {
    constructor(trace: LocationTrace, public value: AST) { super(trace); }
    edgemost(left: boolean): AST { return this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTInterpolation(this.location, fn(this.value)); }
    constantFold(): AST { return new ASTInterpolation(this.location, this.value.constantFold()); }
}

export class ASTSplatExpression extends AST {
    constructor(trace: LocationTrace, public value: AST) { super(trace); }
    edgemost(left: boolean): AST { return this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTSplatExpression(this.location, fn(this.value)); }
    constantFold(): AST { return new ASTSplatExpression(this.location, this.value.constantFold()); }
}

export class ASTPipePlaceholder extends ASTLeaf {
}

export class ASTBlock extends AST {
    constructor(trace: LocationTrace, public body: AST[]) { super(trace); }
    edgemost(left: boolean): AST { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
    pipe(fn: (node: AST) => AST) { return new ASTBlock(this.location, this.body.map(fn)); }
    constantFold(): AST { return new ASTBlock(this.location, this.body.map(a => a.constantFold())); }
}
