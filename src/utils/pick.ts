/**
 * Returns a filtered copy of `obj` with only the given keys present.
 */
export function pick<T>(obj: T, ...keys: (keyof T)[]): Partial<T> {
    // Based on https://github.com/jonschlinkert/object.pick/blob/master/index.js
    const res: Partial<T> = {};

    const len = keys.length;
    let idx = -1;

    while (++idx < len) {
        const key = keys[idx];
        if (key in obj) {
            res[key] = obj[key];
        }
    }
    return res;
}