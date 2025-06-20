import { isArray, isString } from "./utils";

type MacroExpander<T extends Array<any>> = (...args: T) => T;
export const macroexpand = <T extends Array<any>, M extends string>(tree: T, macros: Record<M, MacroExpander<T>>): T =>
    !isArray(tree)
        ? tree
        : isString(tree[0]) && tree[0] in macros
            ? macros[tree[0] as M](...tree.slice(1) as T)
            : tree.map(el => macroexpand(el, macros)) as T;
