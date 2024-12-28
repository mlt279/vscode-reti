// This only works up to 32 bits (so 0-31) since bitwise operations in JS are 32 bit.
export function generateBitMask(length: number): number {
    if (length < 0 || length > 32) { return -1; }
    if (length === 32) { return 0xfffffff; }
    return (1 << length) - 1;
}

// Takes binary number either as number value or as string with spaces and underscores.
// Returns the hex string (only positive) of each for bits as hex.
export function binToHex(bin: number | string): string {
    let hexString = "";
    if (typeof bin === 'string') {
        bin = bin.split(' ').join('');
        bin = bin.replace('_', '');
        bin = parseInt(bin, 2);
    }

    for (let i = 7; i >= 0; i--) {
        let hex = bin >> i * 4 & 0b1111;
        hexString += hex.toString(16);
    }

    return hexString;
}

// Takes a hex string and returns the 32 bit binary string.
export function hexToBin(hex: string): string {
    return parseInt(hex, 16).toString(2).padStart(32, '0');
}

// 
export function immediateAsTwoc(immediate: number): number {
    if ((immediate & (1 << 23)) !== 0) {
        return immediate | 0xff000000;
    }
    return immediate;
}

//
export function immediateUnsigned(immediate: number): number {
    return immediate >>> 0;
}