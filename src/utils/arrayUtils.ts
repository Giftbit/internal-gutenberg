export function sameElements(array1: string[], array2: string[]): boolean {
    return array1.sort().join(",") === array2.sort().join(",");
}