"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * (c) 2019 Micro:bit Educational Foundation and the microbit-fs contributors.
 * SPDX-License-Identifier: MIT
 */
const fs = __importStar(require("fs"));
const uicr_js_1 = require("../uicr.js");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Read MicroPython UICR data.', () => {
    const uPy1HexFile = fs.readFileSync('./src/__tests__/upy-v1.0.1.hex', 'utf8');
    const uPy2HexFile = fs.readFileSync('./src/__tests__/upy-v2-beta-uicr.hex', 'utf8');
    (0, vitest_1.it)('Read MicroPython v1.0.1 hex file UICR', () => {
        const expectedPageSize = 1024;
        const expectedFlashSize = 256 * 1024;
        const expectedFlashStartAddress = 0;
        const expectedFlashEndAddress = 256 * 1024;
        const expectedRuntimeStartPage = 0;
        const MicroPythonLastByteUsed = 0x388b8;
        const expectedRuntimeEndPage = Math.ceil(MicroPythonLastByteUsed / expectedPageSize);
        const expectedRuntimeEndAddress = expectedRuntimeEndPage * expectedPageSize;
        const expectedUicrStartAddress = 0x100010c0;
        const expectedUicrEndAddress = 0x100010dc;
        const expectedFsStartAddress = expectedRuntimeEndAddress;
        const expectedFsEndAddress = expectedFlashEndAddress;
        const expectedUPyVersion = 'micro:bit v1.0.1+b0bf4a9 on 2018-12-13; ' +
            'MicroPython v1.9.2-34-gd64154c73 on 2017-09-01';
        const expectedDeviceVersion = 'V1';
        const result = (0, uicr_js_1.getIntelHexUicrData)(uPy1HexFile);
        (0, vitest_1.expect)(result.flashPageSize).toEqual(expectedPageSize);
        (0, vitest_1.expect)(result.flashSize).toEqual(expectedFlashSize);
        (0, vitest_1.expect)(result.flashStartAddress).toEqual(expectedFlashStartAddress);
        (0, vitest_1.expect)(result.flashEndAddress).toEqual(expectedFlashEndAddress);
        (0, vitest_1.expect)(result.runtimeStartAddress).toEqual(expectedRuntimeStartPage * expectedPageSize);
        (0, vitest_1.expect)(result.runtimeEndAddress).toEqual(expectedRuntimeEndPage * expectedPageSize);
        (0, vitest_1.expect)(result.fsStartAddress).toEqual(expectedFsStartAddress);
        (0, vitest_1.expect)(result.fsEndAddress).toEqual(expectedFsEndAddress);
        (0, vitest_1.expect)(result.uicrStartAddress).toEqual(expectedUicrStartAddress);
        (0, vitest_1.expect)(result.uicrEndAddress).toEqual(expectedUicrEndAddress);
        (0, vitest_1.expect)(result.uPyVersion).toEqual(expectedUPyVersion);
        (0, vitest_1.expect)(result.deviceVersion).toEqual(expectedDeviceVersion);
    });
    (0, vitest_1.it)('Read MicroPython v2.0.0 beta hex file UICR', () => {
        const expectedPageSize = 4096;
        const expectedFlashSize = 512 * 1024;
        const expectedFlashStartAddress = 0;
        const expectedFlashEndAddress = 512 * 1024;
        const expectedRuntimeStartPage = 0;
        // This is the last address used, but the UICR has been manually created
        // to indicate 104 pages used
        const expectedRuntimeEndPage = 109;
        const expectedUicrStartAddress = 0x100010c0;
        const expectedUicrEndAddress = 0x100010dc;
        const expectedFsStartAddress = 0x6d000;
        const expectedFsEndAddress = 0x73000;
        const expectedUPyVersion = 'micro:bit v2.0.99+3e09245 on 2020-11-02; ' +
            'MicroPython 3e09245 on 2020-11-02';
        const expectedDeviceVersion = 'V2';
        const result = (0, uicr_js_1.getIntelHexUicrData)(uPy2HexFile);
        (0, vitest_1.expect)(result.flashPageSize).toEqual(expectedPageSize);
        (0, vitest_1.expect)(result.flashSize).toEqual(expectedFlashSize);
        (0, vitest_1.expect)(result.flashStartAddress).toEqual(expectedFlashStartAddress);
        (0, vitest_1.expect)(result.flashEndAddress).toEqual(expectedFlashEndAddress);
        (0, vitest_1.expect)(result.runtimeStartAddress).toEqual(expectedRuntimeStartPage * expectedPageSize);
        (0, vitest_1.expect)(result.runtimeEndAddress).toEqual(expectedRuntimeEndPage * expectedPageSize);
        (0, vitest_1.expect)(result.fsStartAddress).toEqual(expectedFsStartAddress);
        (0, vitest_1.expect)(result.fsEndAddress).toEqual(expectedFsEndAddress);
        (0, vitest_1.expect)(result.uicrStartAddress).toEqual(expectedUicrStartAddress);
        (0, vitest_1.expect)(result.uicrEndAddress).toEqual(expectedUicrEndAddress);
        (0, vitest_1.expect)(result.uPyVersion).toEqual(expectedUPyVersion);
        (0, vitest_1.expect)(result.deviceVersion).toEqual(expectedDeviceVersion);
    });
    (0, vitest_1.it)('UICR data without MicroPython magic number', () => {
        const makeCodeUicr = ':020000041000EA\n' +
            ':0410140000C0030015\n' +
            ':040000050003C0C173\n' +
            ':00000001FF\n';
        const failCase = () => {
            (0, uicr_js_1.getIntelHexUicrData)(makeCodeUicr);
        };
        (0, vitest_1.expect)(failCase).toThrow(Error);
    });
    // TODO: Write these tests
    /*
    it('UICR data with wrong magic numbers.', () => {});
    it('UICR data without enough MicroPython data.', () => {});
    it('UICR MicroPython version address is not in Intel Hex.', () => {});
    it('UICR MicroPython version address data does not have a null terminator.', () => {});
    it('UICR runtimeStartPage is not 0', () => {});
    */
});
//# sourceMappingURL=uicr.spec.js.map