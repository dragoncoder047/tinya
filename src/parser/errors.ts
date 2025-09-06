export class LocationTrace {
    constructor(
        public line: number,
        public col: number,
        public filename: string) { }

    static nowhere = new LocationTrace(0, 0, "unknown");
}
function formatTrace(trace: LocationTrace, message: string, sources: Record<string, string>): string {
    const src = sources[trace.filename] ?? "";
    const lines = src.split("\n");
    const relevantLine = lines[trace.line] || "";
    const lineNumberString = trace.line + 1 + "";
    return `${trace.filename}:${trace.line + 1}:${trace.col + 1}: ${message}\n${lineNumberString} | ${relevantLine}\n${" ".repeat(lineNumberString.length)} | ${" ".repeat(trace.col)}^`;
}

export class ErrorNote {
    constructor(public message: string, public location: LocationTrace) { }
}

export class ParseError extends Error {
    constructor(message: string, public trace: LocationTrace = LocationTrace.nowhere, public notes: ErrorNote[] = []) {
        super(message);
    }
    displayOn(sources: Record<string, string>): string {
        return formatTrace(this.trace, "error: " + this.message, sources) + this.notes.map(note => "\n" + formatTrace(note.location, note.message, sources)).join("");
    }
}
