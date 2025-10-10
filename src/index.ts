export { baseEnv, baseCompileState, nodes, nodeHelp, libSrc, lib } from "./lib";
export * from "./compiler/ast";
export * as AST from "./compiler/ast";
export { SydError, ErrorNote, LocationTrace, ParseError, CompileError, RuntimeError } from "./compiler/errors";
export { parse } from "./compiler";
export { Message, MessageCode } from "./worklet";

export function initWorklet(context: AudioContext, pathToWorkletScript?: URL | string) {
    if (pathToWorkletScript === undefined) {
        pathToWorkletScript = new URL("./sydWorklet.js", import.meta.url);
    }
    context.audioWorklet.addModule(pathToWorkletScript);
}
