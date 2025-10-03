import { LocationTrace } from "./errors";

export abstract class AST {
    constructor(public location: LocationTrace) { }
    abstract edgemost(left: boolean): AST;
    abstract pipe(fn: (node: AST) => AST): AST;
}

class ASTLeaf extends AST {
    edgemost() { return this; }
    pipe() { return this; }
}

export class ASTAnnotatedValue extends AST {
    constructor(trace: LocationTrace, public attributes: AST[], public value: AST | null = null) { super(trace); }
    pipe(fn: (node: AST) => AST): AST { return new ASTAnnotatedValue(this.location, this.attributes.map(fn), this.value ? fn(this.value) : null); }
    edgemost(left: boolean): AST { return left ? (this.attributes.length > 0 ? this.attributes[0]!.edgemost(left) : this) : (this.value ?? this); }
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
}

export class ASTNameReference extends ASTLeaf {
    constructor(trace: LocationTrace, public name: string) { super(trace); };
}

export class ASTCall extends AST {
    constructor(trace: LocationTrace, public name: string, public args: AST[]) { super(trace); };
    edgemost(left: boolean): AST { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
    pipe(fn: (node: AST) => AST) { return new ASTCall(this.location, this.name, this.args.map(fn)); }
}

export class ASTList extends AST {
    constructor(trace: LocationTrace, public values: AST[]) { super(trace); };
    edgemost(left: boolean): AST { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
    pipe(fn: (node: AST) => AST) { return new ASTList(this.location, this.values.map(fn)); }
}

export class ASTDefine extends AST {

    constructor(trace: LocationTrace, public name: string, public parameters: AST[], public body: AST) { super(trace); };
    edgemost(left: boolean): AST { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTDefine(this.location, this.name, this.parameters.map(fn), fn(this.body)); }
}

export class ASTParameterDescriptor extends AST {
    constructor(trace: LocationTrace, public name: string, public enumOptions: AST, public defaultValue: AST) { super(trace) }
    edgemost(left: boolean): AST { return left ? this : this.defaultValue.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTParameterDescriptor(this.location, this.name, fn(this.enumOptions), fn(this.defaultValue)) }
}

export class ASTTemplate extends AST {
    constructor(trace: LocationTrace, public result: AST) { super(trace); };
    edgemost(left: boolean): AST { return this.result.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTTemplate(this.location, fn(this.result)); }
}

export class ASTBinaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public left: AST, public right: AST, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(trace); };
    edgemost(left: boolean): AST { return this[left ? "left" : "right"].edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTBinaryOp(this.location, this.op, fn(this.left), fn(this.right), this.noLift, this.assign); }
}

export class ASTUnaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public value: AST) { super(trace); };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTUnaryOp(this.location, this.op, fn(this.value)); }
}

export class ASTDefaultPlaceholder extends ASTLeaf {
}

export class ASTKeywordArg extends AST {
    constructor(trace: LocationTrace, public name: string, public arg: AST) { super(trace); }
    edgemost(left: boolean): AST { return left ? this : this.arg.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTKeywordArg(this.location, this.name, fn(this.arg)); }
}

export class ASTMapping extends AST {
    constructor(trace: LocationTrace, public mapping: { key: AST, val: AST }[]) { super(trace); }
    edgemost(left: boolean): AST { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
    pipe(fn: (node: AST) => AST) { return new ASTMapping(this.location, this.mapping.map(({ key, val }) => ({ key: fn(key), val: fn(val) }))); }
}

export class ASTConditional extends AST {
    constructor(trace: LocationTrace, public cond: AST, public caseTrue: AST, public caseFalse: AST) { super(trace); }
    edgemost(left: boolean): AST { return (left ? this.cond : this.caseFalse).edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTConditional(this.location, fn(this.cond), fn(this.caseTrue), fn(this.caseFalse)); }
}

export class ASTInterpolation extends AST {
    constructor(trace: LocationTrace, public value: AST) { super(trace); }
    edgemost(left: boolean): AST { return this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTInterpolation(this.location, fn(this.value)); }
}

export class ASTSplatExpression extends AST {
    constructor(trace: LocationTrace, public value: AST) { super(trace); }
    edgemost(left: boolean): AST { return this.value.edgemost(left); }
    pipe(fn: (node: AST) => AST) { return new ASTSplatExpression(this.location, fn(this.value)); }
}

export class ASTPipePlaceholder extends ASTLeaf {
}

export class ASTBlock extends AST {
    constructor(trace: LocationTrace, public body: AST[]) { super(trace); }
    edgemost(left: boolean): AST { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
    pipe(fn: (node: AST) => AST) { return new ASTBlock(this.location, this.body.map(fn)); }
}
