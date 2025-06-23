interface JSONArray<T> extends Array<JSONValue<T>> { }
interface JSONObject<T> { [key: string]: JSONValue<T>; }
type JSONValue<T = never> = T | string | number | boolean | null | JSONArray<T> | JSONObject<T>;
export function minparse(str: string): JSONValue<undefined> {
    str = str
        .replace(/([,\[\{}])([=>.]?[a-z_]+?)([,:\]\}])/ig, "$1\"$2\"$3")
        .replace(/([,\[])!0([,\]])/g, "$1true$2")
        .replace(/([,\[])!1([,\]])/g, "$1false$2")
        .replace(/\[,/g, "[null,")
        .replace(/,,\]/g, ",null]")
        .replace(/,\s*(?=[,\]])/g, ",null")
        .replace(/([\[,]-?)(?=\.)/g, "$10")
        .replace(/-\./g, "-0.");
    console.log("preprocessed JSON string:", str);

    return JSON.parse(str, (_, value) => value === null ? undefined : value);
}
export function minstringify(x: JSONValue<undefined>): string {
    return JSON.stringify(x)
        .replace(/true/g, "!0")
        .replace(/false/g, "!1")
        .replace(/,null\]/g, ",,]")
        .replace(/\[null,/g, "[,")
        .replace(/,null(?=[,\]])/g, ",")
        .replace(/([\[,]-?)0(?=\.)/g, "$1")
        .replace(/-0\./g, "-.")
        .replace(/([,\[\{])"([=>.]?[a-z_]+?)"([,:\}])/ig, "$1$2$3");
}
