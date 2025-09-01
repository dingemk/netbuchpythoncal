"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * (c) 2019 Micro:bit Educational Foundation and the microbit-fs contributors.
 * SPDX-License-Identifier: MIT
 */
const nrf_intel_hex_1 = __importDefault(require("nrf-intel-hex"));
const vitest_1 = require("vitest");
const micropython_appended_js_1 = require("../micropython-appended.js");
const simpleIntelHex = ':020000040000FA\n' +
    ':1000000000400020ED530100295401002B54010051\n' +
    ':00000001FF\n';
const pyCode = 'from microbit import *\n' + "display.scroll('Hello, World!')";
const pyCodeHex = ':020000040003F7\n' +
    ':10E000004D50360066726F6D206D6963726F626984\n' +
    ':10E010007420696D706F7274202A0A646973706C61\n' +
    ':10E0200061792E7363726F6C6C282748656C6C6F16\n' +
    ':10E030002C20576F726C642127290000000000001B';
const marker = ':::::::::::::::::::::::::::::::::::::::::::';
(0, vitest_1.describe)('Inject Python code into Intel Hex string', () => {
    (0, vitest_1.it)('Inject Python code into an Intel Hex string', () => {
        const output = (0, micropython_appended_js_1.addIntelHexAppendedScript)(simpleIntelHex, pyCode);
        const fullHex = simpleIntelHex.split('\n');
        fullHex.splice(2, 0, pyCodeHex);
        (0, vitest_1.expect)(output).toEqual(fullHex.join('\n'));
    });
    (0, vitest_1.it)('Inject Python with present UICR and Start Linear Address record', () => {
        const uicr = ':020000041000EA\n' +
            ':1010C0007CB0EE17FFFFFFFF0A0000000000E30006\n' +
            ':0C10D000FFFFFFFF2D6D0300000000007B';
        const record = ':0400000500018E2147';
        const fullHex = simpleIntelHex.split('\n');
        fullHex.splice(2, 0, uicr + '\n' + record);
        const output = (0, micropython_appended_js_1.addIntelHexAppendedScript)(fullHex.join('\n'), pyCode);
        const expectedHex = simpleIntelHex.split('\n');
        // Note that the 05 record is removed by nrf-intel-hex library!
        expectedHex.splice(2, 0, pyCodeHex + '\n' + uicr);
        (0, vitest_1.expect)(output).toEqual(expectedHex.join('\n'));
    });
    (0, vitest_1.it)('Inject Python in a hex with a  marker', () => {
        const fullHexWithMarker = simpleIntelHex.split('\n');
        fullHexWithMarker.splice(2, 0, marker);
        const fullHexWithout = simpleIntelHex.split('\n');
        const expectedHex = simpleIntelHex.split('\n');
        expectedHex.splice(2, 0, pyCodeHex);
        const outputWithMarker = (0, micropython_appended_js_1.addIntelHexAppendedScript)(fullHexWithMarker.join('\n'), pyCode);
        const outputWithout = (0, micropython_appended_js_1.addIntelHexAppendedScript)(fullHexWithout.join('\n'), pyCode);
        (0, vitest_1.expect)(outputWithMarker).toEqual(expectedHex.join('\n'));
        (0, vitest_1.expect)(outputWithMarker).toEqual(outputWithout);
    });
    (0, vitest_1.it)('Fail to inject Python code too large for flash', () => {
        const failCase = () => {
            const fakeCode = new Array(8 * 1024 + 2).join('a');
            (0, micropython_appended_js_1.addIntelHexAppendedScript)(simpleIntelHex, fakeCode);
        };
        (0, vitest_1.expect)(failCase).toThrow(RangeError);
    });
});
(0, vitest_1.describe)('Extract Python code from Intel Hex string', () => {
    (0, vitest_1.it)('Extract Python code', () => {
        const intelHex1 = ':020000040000FA\n' +
            ':1000000000400020ED530100295401002B54010051\n' +
            ':020000040003F7\n' +
            pyCodeHex +
            '\n' +
            ':00000001FF\n';
        // pyCodeHex contains zeros to fill the record, this example doesn't
        const intelHex2 = ':020000040000FA\n' +
            ':1000000000400020ED530100295401002B54010051\n' +
            ':020000040003F7\n' +
            ':10E000004D50360066726F6D206D6963726F626984\n' +
            ':10E010007420696D706F7274202A0A646973706C61\n' +
            ':10E0200061792E7363726F6C6C282748656C6C6F16\n' +
            ':0AE030002C20576F726C6421272921\n' +
            ':00000001FF\n';
        const result1 = (0, micropython_appended_js_1.getIntelHexAppendedScript)(intelHex1);
        const result2 = (0, micropython_appended_js_1.getIntelHexAppendedScript)(intelHex2);
        (0, vitest_1.expect)(result1).toEqual(pyCode);
        (0, vitest_1.expect)(result2).toEqual(pyCode);
    });
    (0, vitest_1.it)('Extract Python code with present UICR and Start Linear Address record)', () => {
        const intelHex = ':020000040000FA\n' +
            ':1000000000400020ED530100295401002B54010051\n' +
            ':020000040003F7\n' +
            ':10E000004D50360066726F6D206D6963726F626984\n' +
            ':10E010007420696D706F7274202A0A646973706C61\n' +
            ':10E0200061792E7363726F6C6C282748656C6C6F16\n' +
            ':0AE030002C20576F726C6421272921\n' +
            ':020000041000EA\n' +
            ':1010C0007CB0EE17FFFFFFFF0A0000000000E30006\n' +
            ':0C10D000FFFFFFFF2D6D0300000000007B\n' +
            ':0400000500018E2147\n' +
            ':00000001FF\n';
        const result = (0, micropython_appended_js_1.getIntelHexAppendedScript)(intelHex);
        (0, vitest_1.expect)(result).toEqual(pyCode);
    });
    (0, vitest_1.it)('There is no Python code to extract', () => {
        const intelHex = ':020000040000FA\n' +
            ':1000000000400020ED530100295401002B54010051\n' +
            ':00000001FF\n';
        const result = (0, micropython_appended_js_1.getIntelHexAppendedScript)(intelHex);
        (0, vitest_1.expect)(result).toEqual('');
    });
    (0, vitest_1.it)('The Python code block contains garbage', () => {
        const intelHex = ':020000040000FA\n' +
            ':1000000000400020ED530100295401002B54010051\n' +
            ':020000040003F7\n' +
            ':10E000000102030405060708090A0B0C0D0E0F1088\n' +
            ':00000001FF\n';
        const result = (0, micropython_appended_js_1.getIntelHexAppendedScript)(intelHex);
        (0, vitest_1.expect)(result).toEqual('');
    });
});
(0, vitest_1.describe)('Detect appended script.', () => {
    (0, vitest_1.it)('Appended script can be detected.', () => {
        const outputHex = (0, micropython_appended_js_1.addIntelHexAppendedScript)(simpleIntelHex, 'code');
        const outputMap = nrf_intel_hex_1.default.fromHex(outputHex);
        const resultStr = (0, micropython_appended_js_1.isAppendedScriptPresent)(outputHex);
        const resultMap = (0, micropython_appended_js_1.isAppendedScriptPresent)(outputMap);
        (0, vitest_1.expect)(resultStr).toBe(true);
        (0, vitest_1.expect)(resultMap).toBe(true);
    });
    (0, vitest_1.it)('Missing appended script can be detected.', () => {
        const simpleMap = nrf_intel_hex_1.default.fromHex(simpleIntelHex);
        const resultStr = (0, micropython_appended_js_1.isAppendedScriptPresent)(simpleIntelHex);
        const resultMap = (0, micropython_appended_js_1.isAppendedScriptPresent)(simpleMap);
        (0, vitest_1.expect)(resultStr).toBe(false);
        (0, vitest_1.expect)(resultMap).toBe(false);
    });
    (0, vitest_1.it)('Appended script area with rubbish is not detected as code.', () => {
        // There is 8 Kbs at the end of flash for the appended script
        const appendedAddress = (256 - 8) * 1024;
        const simpleMap = nrf_intel_hex_1.default.fromHex(simpleIntelHex);
        simpleMap.set(appendedAddress, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9, 0]));
        const result = (0, micropython_appended_js_1.isAppendedScriptPresent)(simpleMap);
        (0, vitest_1.expect)(result).toBe(false);
    });
});
//# sourceMappingURL=micropython-appended.spec.js.map