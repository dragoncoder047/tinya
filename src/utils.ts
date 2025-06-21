import type { NodeName, NodeTree } from "./types";

export const mapObject = <T, U>(obj: Record<string, T>, func: (value: T, key: string) => U): Record<string, U> =>
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, func(value, key)]));

const typeOf = (x: any) => typeof x;
export const is = (t: string, func: (x: any) => any = typeOf) => (x: any) => func(x) === t;
export const isNumber = is("number") as (x: any) => x is number;
export const isUndefined = is("undefined") as (x: any) => x is undefined;
export const isString = is("string") as (x: any) => x is string;
export const isNull = (x: any): x is null => x === null;
export const isEmpty = (x: any[]): x is [] => x.length === 0;
export const isNegativeZero = (x: number): x is -0 => Object.is(x, -0);
export const isNotNegative = (x: number) => (x > 0) || ((x === 0) && !isNegativeZero(x));
type Predicate<T, U extends T> = (x: T) => x is U;
type AssertedType<F> = F extends (x: any) => x is infer U ? U : never;
type UnionOfPredicates<T, Fns extends readonly ((x: T) => x is any)[]> = AssertedType<Fns[number]>;
export const any = <T, const Fns extends readonly Predicate<T, any>[]>(x: T, ...funcs: Fns): x is UnionOfPredicates<T, Fns> => funcs.some(f => f(x));
export const isArray = Array.isArray;
export const isObject = is("object") as (x: any) => x is Record<string, any>;

// NEW named references
// constant = null, undefined, number
// node = [nodeType, ...arguments], or ["=nodeName", nodeType, ...arguments] for a named node
// node with constructor parameters = [[nodeType, ...constructorArgs], ...arguments] or ["=nodeName", [nodeType, ...constructorArgs], ...arguments] for a named node
// ref = "@nodeName"
// input ref = ">inputName"

export const isConstant = (x: any): x is null | undefined | number | string => any(x, isNull, isUndefined, isNumber) || (isString(x) && !(isRef(x) || isNodeName(x) || isInputRef(x)));
export const isNode = (x: any): x is NodeTree =>
    any(x, isString, isNumber, isUndefined, isNull)
        ? false
        : isArray(x) && isString(x[0])
            ? (isNamedNode(x) ? isNode(getNodeContents(x)) : true)
            : (isArray(x[0]) && !isEmpty(x[0]) && isString(x[0][0]));

const isTypeString = <T extends string>(starter: T) => (x: any): x is `${T}${string}` =>
    isString(x) && x.startsWith(starter);
export const isRef = isTypeString(".");
export const isNodeName = isTypeString("=");
export const isInputRef = isTypeString(">");
export const isNamedNode = (x: any): x is [NodeName, ...any[]] => isArray(x) && isNodeName(x[0]);
export const getNodeName = (x: any): NodeName | undefined => isNamedNode(x) ? x[0] : undefined;
export const getNodeContents = (x: any): any[] => isNamedNode(x) ? x.slice(1) : x;


const gensymCounters: Record<string, number> = {};
export const gensym = <T extends string>(prefix: T): `${T}${number}` => {
    gensymCounters[prefix] = (gensymCounters[prefix] || 0) + 1;
    return `${prefix}${gensymCounters[prefix]}` as const;
}
