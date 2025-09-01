"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * (c) 2019 Micro:bit Educational Foundation and the microbit-fs contributors.
 * SPDX-License-Identifier: MIT
 */
const common_js_1 = require("../common.js");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('strToBytes', () => {
    (0, vitest_1.it)('works with 1 byte characters', () => {
        const testString = 'test';
        const testCodes = [116, 101, 115, 116];
        const tester = (0, common_js_1.strToBytes)(testString).values();
        for (const code of testCodes) {
            (0, vitest_1.expect)(tester.next().value).toEqual(code);
        }
    });
    (0, vitest_1.it)('works with 2 byte characters', () => {
        const testString = 'Ση';
        const testCodes = [206, 163, 206, 183];
        const tester = (0, common_js_1.strToBytes)(testString).values();
        for (const code of testCodes) {
            (0, vitest_1.expect)(tester.next().value).toEqual(code);
        }
    });
    (0, vitest_1.it)('works with 3 byte characters', () => {
        const testString = '世';
        const testCodes = [228, 184, 150];
        const tester = (0, common_js_1.strToBytes)(testString).values();
        for (const code of testCodes) {
            (0, vitest_1.expect)(tester.next().value).toEqual(code);
        }
    });
});
(0, vitest_1.describe)('bytesToStr', () => {
    (0, vitest_1.it)('works with 1 byte characters', () => {
        const testCodes = new Uint8Array([116, 101, 115, 116]);
        (0, vitest_1.expect)((0, common_js_1.bytesToStr)(testCodes)).toEqual('test');
    });
    (0, vitest_1.it)('works with 2 byte characters', () => {
        const testCodes = new Uint8Array([206, 163, 206, 183]);
        (0, vitest_1.expect)((0, common_js_1.bytesToStr)(testCodes)).toEqual('Ση');
    });
    (0, vitest_1.it)('works with 3 byte characters', () => {
        const testCodes = new Uint8Array([228, 184, 150]);
        (0, vitest_1.expect)((0, common_js_1.bytesToStr)(testCodes)).toEqual('世');
    });
});
(0, vitest_1.describe)('concatUint8Array', () => {
    (0, vitest_1.it)('concatenates correctly', () => {
        const firstArray = [116, 101, 115, 116];
        const secondArray = [234, 56, 45, 98];
        const first = new Uint8Array(firstArray);
        const second = new Uint8Array(secondArray);
        const result1 = (0, common_js_1.concatUint8Array)(first, first);
        const result2 = (0, common_js_1.concatUint8Array)(second, second);
        const result3 = (0, common_js_1.concatUint8Array)(first, second);
        (0, vitest_1.expect)(result1).toEqual(new Uint8Array(firstArray.concat(firstArray)));
        (0, vitest_1.expect)(result2).toEqual(new Uint8Array(secondArray.concat(secondArray)));
        (0, vitest_1.expect)(result3).toEqual(new Uint8Array(firstArray.concat(secondArray)));
    });
    (0, vitest_1.it)('concatenates correctly empty arrays', () => {
        const first = new Uint8Array([]);
        const second = new Uint8Array([]);
        const result = (0, common_js_1.concatUint8Array)(first, second);
        (0, vitest_1.expect)(result).toEqual(new Uint8Array([]));
    });
    (0, vitest_1.it)('concatenates arrays of different length', () => {
        const firstArray = [116, 101, 115, 116];
        const secondArray = [234, 56, 45, 98, 0];
        const first = new Uint8Array(firstArray);
        const second = new Uint8Array(secondArray);
        const result1 = (0, common_js_1.concatUint8Array)(first, second);
        const result2 = (0, common_js_1.concatUint8Array)(second, first);
        (0, vitest_1.expect)(result1).toEqual(new Uint8Array(firstArray.concat(secondArray)));
        (0, vitest_1.expect)(result2).toEqual(new Uint8Array(secondArray.concat(firstArray)));
    });
});
(0, vitest_1.describe)('areUint8ArraysEqual', () => {
    (0, vitest_1.it)('compares correctly equal arrays', () => {
        const first = new Uint8Array([116, 101, 115, 116]);
        const second = new Uint8Array([116, 101, 115, 116]);
        const result1 = (0, common_js_1.areUint8ArraysEqual)(first, first);
        const result2 = (0, common_js_1.areUint8ArraysEqual)(second, second);
        const result3 = (0, common_js_1.areUint8ArraysEqual)(first, second);
        (0, vitest_1.expect)(result1).toBeTruthy();
        (0, vitest_1.expect)(result2).toBeTruthy();
        (0, vitest_1.expect)(result3).toBeTruthy();
    });
    (0, vitest_1.it)('compares correctly empty arrays', () => {
        const first = new Uint8Array([]);
        const second = new Uint8Array([]);
        const result = (0, common_js_1.areUint8ArraysEqual)(first, second);
        (0, vitest_1.expect)(result).toBeTruthy();
    });
    (0, vitest_1.it)('compares arrays of different length', () => {
        const first = new Uint8Array([5, 12, 46]);
        const second = new Uint8Array([5, 12, 46, 0]);
        const result1 = (0, common_js_1.areUint8ArraysEqual)(first, second);
        const result2 = (0, common_js_1.areUint8ArraysEqual)(second, first);
        (0, vitest_1.expect)(result1).toBeFalsy();
        (0, vitest_1.expect)(result2).toBeFalsy();
    });
    (0, vitest_1.it)('compares different arrays', () => {
        const first = new Uint8Array([1, 2, 3]);
        const second = new Uint8Array([4, 5, 6]);
        const result1 = (0, common_js_1.areUint8ArraysEqual)(first, second);
        const result2 = (0, common_js_1.areUint8ArraysEqual)(second, first);
        (0, vitest_1.expect)(result1).toBeFalsy();
        (0, vitest_1.expect)(result2).toBeFalsy();
    });
});
//# sourceMappingURL=common.spec.js.map