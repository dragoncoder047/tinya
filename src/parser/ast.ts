import { LocationTrace } from "./errors";

export enum ASTType {
    CONSTANT,
    STRING_CONSTANT,
    SYMBOL,
    NAME_REF,
    ASSIGN,
    CALL,
    LIST,
    DEFINE,
    TEMPLATE,
    INTERPOLATION,
    BINARY_OP,
    UNARY_OP,
    CONDITIONAL,
    DEFAULT,
    KW_ARG,
    BLOCK,
    PARAMETER,
    MAPPING,
}

export abstract class AST {
    constructor(public type: ASTType, public location: LocationTrace) { }
    abstract edgemost(left: boolean): AST;
    map(fn: (node: AST) => AST): AST { return this; }
}

export class ASTConstant extends AST {
    constructor(trace: LocationTrace, public value: number) { super(ASTType.CONSTANT, trace); };
    edgemost() { return this; }
}

export class ASTStringConstant extends AST {
    constructor(trace: LocationTrace, public value: string) { super(ASTType.STRING_CONSTANT, trace); };
    edgemost() { return this; }
}

export class ASTSymbol extends AST {
    constructor(trace: LocationTrace, public value: string) { super(ASTType.SYMBOL, trace); };
    edgemost() { return this; }
}

export class ASTAssignment extends AST {
    constructor(trace: LocationTrace, public name: string, public value: AST) { super(ASTType.ASSIGN, trace); };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTAssignment(this.location, this.name, fn(this.value)); }
}

export class ASTNameReference extends AST {
    constructor(trace: LocationTrace, public name: string) { super(ASTType.NAME_REF, trace); };
    edgemost() { return this; }
}

export class ASTCall extends AST {
    constructor(trace: LocationTrace, public name: string, public args: AST[]) { super(ASTType.CALL, trace); };
    edgemost(left: boolean): AST { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
    map(fn: (node: AST) => AST) { return new ASTCall(this.location, this.name, this.args.map(fn)); }
}

export class ASTList extends AST {
    constructor(trace: LocationTrace, public values: AST[]) { super(ASTType.LIST, trace); };
    edgemost(left: boolean): AST { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
    map(fn: (node: AST) => AST) { return new ASTList(this.location, this.values.map(fn)); }
}

export class ASTDefine extends AST {
    constructor(trace: LocationTrace, public name: string, public parameters: AST[], public body: AST) { super(ASTType.DEFINE, trace); };
    edgemost(left: boolean): AST { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTDefine(this.location, this.name, this.parameters.map(fn), fn(this.body)); }
}

export class ASTParameterDescriptor extends AST {
    constructor(trace: LocationTrace, public name: string, public enumOptions: AST, public defaultValue: AST) { super(ASTType.PARAMETER, trace) }
    edgemost(left: boolean): AST { return left ? this : this.defaultValue.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTParameterDescriptor(this.location, this.name, fn(this.enumOptions), fn(this.defaultValue)) }
}

export class ASTTemplate extends AST {
    constructor(trace: LocationTrace, public result: AST) { super(ASTType.TEMPLATE, trace); };
    edgemost(left: boolean): AST { return this.result.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTTemplate(this.location, fn(this.result)); }
}

export class ASTBinaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public left: AST, public right: AST, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(ASTType.BINARY_OP, trace); };
    edgemost(left: boolean): AST { return this[left ? "left" : "right"].edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTBinaryOp(this.location, this.op, fn(this.left), fn(this.right), this.noLift, this.assign); }
}

export class ASTUnaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public value: AST) { super(ASTType.UNARY_OP, trace); };
    edgemost(left: boolean): AST { return left ? this : this.value.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTUnaryOp(this.location, this.op, fn(this.value)); }
}

export class ASTDefaultPlaceholder extends AST {
    constructor(trace: LocationTrace) { super(ASTType.DEFAULT, trace); };
    edgemost() { return this; }
}

export class ASTKeywordArg extends AST {
    constructor(trace: LocationTrace, public name: string, public arg: AST) { super(ASTType.KW_ARG, trace); }
    edgemost(left: boolean): AST { return left ? this : this.arg.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTKeywordArg(this.location, this.name, fn(this.arg)); }
}

export class ASTMapping extends AST {
    constructor(trace: LocationTrace, public mapping: { key: AST, val: AST }[]) { super(ASTType.MAPPING, trace); }
    edgemost(left: boolean): AST { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
    map(fn: (node: AST) => AST) { return new ASTMapping(this.location, this.mapping.map(({ key, val }) => ({ key: fn(key), val: fn(val) }))); }
}

export class ASTConditional extends AST {
    constructor(trace: LocationTrace, public cond: AST, public caseTrue: AST, public caseFalse: AST) { super(ASTType.CONDITIONAL, trace); }
    edgemost(left: boolean): AST { return (left ? this.cond : this.caseFalse).edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTConditional(this.location, fn(this.cond), fn(this.caseTrue), fn(this.caseFalse)); }
}

export class ASTInterpolation extends AST {
    constructor(trace: LocationTrace, public value: AST) { super(ASTType.INTERPOLATION, trace); }
    edgemost(left: boolean): AST { return this.value.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTInterpolation(this.location, fn(this.value)); }
}

export class ASTBlock extends AST {
    constructor(trace: LocationTrace, public body: AST[]) { super(ASTType.BLOCK, trace); }
    edgemost(left: boolean): AST { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
    map(fn: (node: AST) => AST) { return new ASTBlock(this.location, this.body.map(fn)); }
}
