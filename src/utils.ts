import type { NodeTree, NodeImpl } from "./types";

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
type NodeType = "constant" | "node" | "ref" | "input";
// unholy ternary from hell
const classify = (x: any): NodeType | undefined =>
    any(x, isNull, isUndefined, isNumber)
        ? "constant"
        : !isArray(x) || isEmpty(x)
            ? undefined
            : any(x[0], isString, isUndefined, isNull) || (isArray(x[0]) && (isEmpty(x[0]) || isString(x[0][0])))
                ? "node"
                : !isNumber(x[0])
                    ? undefined
                    : x.length > 1 && x.every(z => isNumber(z) && !isNotNegative(z))
                        ? "input"
                        : "ref";
export const isConstant = is("constant", classify) as (x: any) => x is (null | undefined | number);
export const isNode = is("node", classify) as (x: any) => x is NodeTree;
export const isRef = is("ref", classify) as (x: any) => x is [number, ...number[]];
export const isInputRef = is("input", classify) as (x: any) => x is [number, ...number[]];
export const constant = (_: number, num: number): NodeImpl => () => num;
