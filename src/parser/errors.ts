export class LocationTrace {
    constructor(
        public line: number,
        public col: number,
        public filename: string,
        public parentNote?: string,
        public parent?: LocationTrace) { }
    withSourceNote(note: string, src: LocationTrace = this) {
        return new LocationTrace(this.line, this.col, this.filename, note, src);
    }

    static unknown = new LocationTrace(0, 0, "unknown");
}
function formatTrace(trace: LocationTrace, message: string, sources: Record<string, string>): string {
    const src = sources[trace.filename] ?? "";
    const lines = src.split("\n");
    const relevantLine = lines[trace.line] || "";
    const lineNumberString = trace.line + 1 + "";
    return `${trace.filename}:${trace.line + 1}:${trace.col + 1}: ${message}\n${lineNumberString} | ${relevantLine}\n${" ".repeat(lineNumberString.length)} | ${" ".repeat(trace.col)}^${trace.parent ? `\n${formatTrace(trace.parent, trace.parentNote!, sources)}` : ""}`;
}

export class ParseError extends Error {
    constructor(message: string, public trace: LocationTrace = LocationTrace.unknown) {
        super(message);
    }
    displayOn(sources: Record<string, string>): string {
        return formatTrace(this.trace, "error: " + this.message, sources);
    }
}
