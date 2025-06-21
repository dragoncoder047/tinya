import { any, isArray, isNull, isNumber, isObject, isString, isUndefined, mapObject } from "./utils";

type MacroExpander = (...args: any) => any;
export const macroexpand = (tree: any, macros: Record<string, MacroExpander>): any => {
    var temp;
    return any(tree, isString, isNumber, isUndefined, isNull)
        ? tree
        : !isArray(tree)
            ? mapObject(tree, v => macroexpand(v, macros))
            : isString(tree[0]) && tree[0] in macros
                ? (any(temp = macros[tree[0]]!(...tree.slice(1)), isArray, isObject) ? macroexpand(temp, macros) : temp)
                : tree.map(el => macroexpand(el, macros));
}
