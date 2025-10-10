export function opt<T extends boolean>(name: string, mustString: T): string | undefined | (T extends true ? never : true) {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const option = process.argv[index + 1];
    if (option === undefined && mustString) throw "expected option after " + JSON.stringify(name);
    return option ?? true as any;
}
