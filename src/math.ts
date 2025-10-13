export const PI = Math.PI;
export const TAU = 2 * PI;
export const min = Math.min;
export const max = Math.max;
export const sqrt = Math.sqrt;
export const clamp = (x: number, y: number, z: number) => max(min(x, z), y);
export const sin = Math.sin;
export const cos = Math.cos;
export const sgn = Math.sign;
export const abs = Math.abs;
export const tan = Math.tan;
export const tanW = (x: number) => clamp(Math.tan(x), -1, 1);
export const saw = (x: number) => 1 - (2 * x / TAU % 2 + 2) % 2;
export const tri = (x: number) => 1 - 4 * abs(Math.round(x / TAU) - x / TAU);
export const noise3 = (x: number) => sin(x ** 3);
export const noise5 = (x: number) => sin(x ** 5);

// From https://stackoverflow.com/a/27205341/23626926
export const matMul = (a: number[][], b: number[][]) => {
    var aNumRows = a.length, aNumCols = a[0]!.length, bNumCols = b[0]!.length, m = [] as number[][];
    for (var r = 0; r < aNumRows; r++) {
        m[r] = [] as number[];
        for (var c = 0; c < bNumCols; c++) {
            m[r]![c] = 0;
            for (var i = 0; i < aNumCols; i++) {
                m[r]![c]! += a[r]![i]! * b[i]![c]!;
            }
        }
    }
    return m;
};
