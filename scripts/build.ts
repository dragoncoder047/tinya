import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { basename, dirname, relative, resolve } from "node:path";
import packageJSON from "../package.json" with { type: "json" };
import { opt } from "./com";

const config: esbuild.BuildOptions = {
    bundle: true,
    sourcemap: true,
    minify: !!opt("-m", false),
    metafile: true,
    platform: "browser",
    charset: "utf8",
    entryPoints: [opt("-i", true) ?? packageJSON.main],
    format: "esm",
    target: "esnext",
    treeShaking: true,
    outfile: opt("-o", true) ?? "build/tinya.js",
    plugins: [
        {
            name: "precache builtin macro code",
            setup(build) {
                // Load ".preparsed.txt" files and return an AST as JS expression
                build.onLoad({ filter: /\.preparsed\.txt$/ }, async args => {
                    const tojsScriptPath = resolve(dirname(import.meta.filename), "tojs");
                    const absSrc = resolve(dirname(import.meta.filename), "../src");
                    const fileDir = dirname(args.path);
                    const pathToSrc = relative(fileDir, absSrc);
                    const code = execFileSync("bun", ["run", tojsScriptPath, "-f", args.path, "-d", basename(args.path), "-p", pathToSrc]);
                    return {
                        contents: code,
                        loader: "js",
                    }
                });
            },
        }
    ],
};

if (opt("-w", false)) {
    config.plugins!.push({
        name: "logger",
        setup(build) {
            build.onEnd(result => {
                if (result.errors.length == 0)
                    console.error(`[${new Date().toISOString()}] rebuilt ${config.outfile} success!`);
                else
                    console.error(`[${new Date().toISOString()}] failed to build ${config.outfile}!`)
            });
        },
    });
    await esbuild.context(config).then(ctx => ctx.watch());
}
else await esbuild.build(config);
