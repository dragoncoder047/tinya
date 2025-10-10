export { baseEnv, baseCompileState, nodes, nodeHelp } from "./lib";
export { AST } from "./compiler/ast";
export { SydError, LocationTrace, ParseError, CompileError, RuntimeError } from "./compiler/errors";
export { parse } from "./compiler";
export { Message, MessageCode } from "./worklet";
export { source as libSrc, ast as lib } from "./lib/data.syd";

export function initWorklet(context: AudioContext, pathToWorkletScript?: URL | string) {
    if (pathToWorkletScript === undefined) {
        pathToWorkletScript = new URL("./sydWorklet.js", import.meta.url);
    }
    context.audioWorklet.addModule(pathToWorkletScript);
}
