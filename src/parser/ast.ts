import { LocationTrace } from "./errors";

export enum ASTType {
    CONSTANT = "CONSTANT",
    SYMBOL = "SYMBOL",
    NAME_REF = "NAME_REF",
    ASSIGN = "ASSIGN",
    NODE = "NODE",
    LIST = "LIST",
    DEFINE = "DEFINE",
    TEMPLATE = "TEMPLATE",
    INTERPOLATION = "INTERPOLATION",
    BINARY_OP = "BINARY_OP",
    UNARY_OP = "UNARY_OP",
    CONDITIONAL = "CONDITIONAL",
    DEFAULT = "DEFAULT",
    BLOCK = "BLOCK"
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

export class ASTNodeCall extends AST {
    constructor(trace: LocationTrace, public name: string, public args: AST[]) { super(ASTType.NODE, trace); };
    edgemost(left: boolean): AST { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
    map(fn: (node: AST) => AST) { return new ASTNodeCall(this.location, this.name, this.args.map(fn)); }
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

export class ASTTemplate extends AST {
    constructor(trace: LocationTrace, public body: AST) { super(ASTType.TEMPLATE, trace); };
    edgemost(left: boolean): AST { return this.body.edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTTemplate(this.location, fn(this.body)); }
}

export class ASTBinaryOp extends AST {
    constructor(trace: LocationTrace, public op: string, public left: AST, public right: AST) { super(ASTType.BINARY_OP, trace); };
    edgemost(left: boolean): AST { return this[left ? "left" : "right"].edgemost(left); }
    map(fn: (node: AST) => AST) { return new ASTBinaryOp(this.location, this.op, fn(this.left), fn(this.right)); }
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
    constructor(trace: LocationTrace, public children: AST[]) { super(ASTType.BLOCK, trace); }
    edgemost(left: boolean): AST { return this.children.length > 0 ? left ? this.children[0]!.edgemost(left) : this.children.at(-1)!.edgemost(left) : this; }
    map(fn: (node: AST) => AST) { return new ASTList(this.location, this.children.map(fn)); }
}
