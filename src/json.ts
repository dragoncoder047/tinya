import { isNegativeZero, isNumber } from "./utils";

interface JSONArray<T> extends Array<JSONValue<T>> { }
interface JSONObject<T> { [key: string]: JSONValue<T>; }
type JSONValue<T = never> = T | string | number | boolean | null | JSONArray<T> | JSONObject<T>;
export function minparse(str: string): JSONValue<undefined> {
    str = str
        .replace(/([,\[])([a-z_]+?)([,\]])/ig, "$1\"$2\"$3")
        .replace(/([,\[])!0([,\]])/g, "$1true$2")
        .replace(/([,\[])!1([,\]])/g, "$1false$2")
        .replace(/\[,/g, "[null,")
        .replace(/,,\]/g, ",null]")
        .replace(/,\s*(?=[,\]])/g, ",null")
        .replace(/([\[,]-?)(?=\.)/g, "$10")
        .replace(/-\./g, "-0.");

    return JSON.parse(str, (_, value) => value === null ? undefined : value);
}
const NEGATIVE_ZERO_SENTINEL = "____NZ"
const stringify = JSON.stringify;
const NEGATIVE_ZERO_SENTINEL_REGEXP = new RegExp(stringify(NEGATIVE_ZERO_SENTINEL), "g");
export function minstringify(x: JSONValue<undefined>): string {
    return stringify(x, (_, v) => isNumber(v) && isNegativeZero(v) ? NEGATIVE_ZERO_SENTINEL : v)
        .replace(/true/g, "!0")
        .replace(/false/g, "!1")
        .replace(/,null\]/g, ",,]")
        .replace(/\[null,/g, "[,")
        .replace(/,null(?=[,\]])/g, ",")
        .replace(/([\[,]-?)0(?=\.)/g, "$1")
        .replace(/-0\./g, "-.")
        .replace(NEGATIVE_ZERO_SENTINEL_REGEXP, "-0")
        .replace(/([,\[])"([a-z_]+?)"([,\]])/ig, "$1$2$3");
}
