import type { PluginBuild } from "esbuild";
import { basename, dirname } from "node:path";
import { toJSFile } from "./tojs";

export function sydPlugin() {
    return {
        name: "syd",
        setup(build: PluginBuild) {
            // Load ".syd" files and return an AST as JS expression
            build.onLoad({ filter: /\.syd$/ }, async args => {
                const { src, watchFiles } = await toJSFile(args.path);
                return {
                    contents: src,
                    watchFiles,
                    loader: "js",
                }
            });
        },
    }
}
