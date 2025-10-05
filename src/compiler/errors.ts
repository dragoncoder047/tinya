export class LocationTrace {
    constructor(
        public line: number,
        public col: number,
        public file: string,
        public source: [string, LocationTrace] | null = null) { }

    static nowhere = new LocationTrace(0, 0, "unknown");
}
function formatTrace(trace: LocationTrace, message: string, sources: Record<string, string>): string {
    const src = sources[trace.file];
    var lineInfo = "";
    if (src) {
        const lines = src.split("\n");
        const relevantLine = lines[trace.line] || "";
        const lineNumberString = trace.line + 1 + "";
        lineInfo = `\n${lineNumberString} | ${relevantLine}\n${" ".repeat(lineNumberString.length)} | ${" ".repeat(trace.col)}^`;
    }
    return `${trace.file}:${trace.line + 1}:${trace.col + 1}: ${message}${lineInfo}${trace.source ? "\n" + formatTrace(trace.source[1], trace.source[0], sources) : ""}`;
}

export class ErrorNote {
    constructor(public message: string, public location: LocationTrace) { }
}

export class TinyAError extends Error {
    constructor(message: string, public trace: LocationTrace = LocationTrace.nowhere, public notes: ErrorNote[] = []) {
        super(message);
    }
    displayOn(sources: Record<string, string>): string {
        return formatTrace(this.trace, "error: " + this.message, sources) + this.notes.map(note => "\n" + formatTrace(note.location, note.message, sources)).join("") + "\n";
    }
}

export class ParseError extends TinyAError { }

export class RuntimeError extends TinyAError { }
