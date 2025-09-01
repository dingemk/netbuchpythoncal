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
 * (c) 2021 Micro:bit Educational Foundation and the microbit-fs contributors.
 * SPDX-License-Identifier: MIT
 */
const fs = __importStar(require("fs"));
const hex_mem_info_js_1 = require("../hex-mem-info.js");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Read MicroPython V1 UICR hex mem info data.', () => {
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
        const expectedFsStartAddress = expectedRuntimeEndAddress;
        const expectedFsEndAddress = expectedFlashEndAddress;
        const expectedUPyVersion = 'micro:bit v1.0.1+b0bf4a9 on 2018-12-13; ' +
            'MicroPython v1.9.2-34-gd64154c73 on 2017-09-01';
        const expectedDeviceVersion = 'V1';
        const result = (0, hex_mem_info_js_1.getIntelHexDeviceMemInfo)(uPy1HexFile);
        (0, vitest_1.expect)(result.flashPageSize).toEqual(expectedPageSize);
        (0, vitest_1.expect)(result.flashSize).toEqual(expectedFlashSize);
        (0, vitest_1.expect)(result.flashStartAddress).toEqual(expectedFlashStartAddress);
        (0, vitest_1.expect)(result.flashEndAddress).toEqual(expectedFlashEndAddress);
        (0, vitest_1.expect)(result.runtimeStartAddress).toEqual(expectedRuntimeStartPage * expectedPageSize);
        (0, vitest_1.expect)(result.runtimeEndAddress).toEqual(expectedRuntimeEndPage * expectedPageSize);
        (0, vitest_1.expect)(result.fsStartAddress).toEqual(expectedFsStartAddress);
        (0, vitest_1.expect)(result.fsEndAddress).toEqual(expectedFsEndAddress);
        (0, vitest_1.expect)(result.uPyVersion).toEqual(expectedUPyVersion);
        (0, vitest_1.expect)(result.deviceVersion).toEqual(expectedDeviceVersion);
    });
    (0, vitest_1.it)('Read MicroPython v2.0.0 beta hex file UICR', () => {
        const expectedPageSize = 4096;
        const expectedFlashSize = 512 * 1024;
        const expectedFlashStartAddress = 0;
        const expectedFlashEndAddress = 512 * 1024;
        const expectedRuntimeStartPage = 0;
        const expectedRuntimeEndPage = 109;
        const expectedFsStartAddress = 0x6d000;
        const expectedFsEndAddress = 0x73000;
        const expectedUPyVersion = 'micro:bit v2.0.99+3e09245 on 2020-11-02; ' +
            'MicroPython 3e09245 on 2020-11-02';
        const expectedDeviceVersion = 'V2';
        const result = (0, hex_mem_info_js_1.getIntelHexDeviceMemInfo)(uPy2HexFile);
        (0, vitest_1.expect)(result.flashPageSize).toEqual(expectedPageSize);
        (0, vitest_1.expect)(result.flashSize).toEqual(expectedFlashSize);
        (0, vitest_1.expect)(result.flashStartAddress).toEqual(expectedFlashStartAddress);
        (0, vitest_1.expect)(result.flashEndAddress).toEqual(expectedFlashEndAddress);
        (0, vitest_1.expect)(result.runtimeStartAddress).toEqual(expectedRuntimeStartPage * expectedPageSize);
        (0, vitest_1.expect)(result.runtimeEndAddress).toEqual(expectedRuntimeEndPage * expectedPageSize);
        (0, vitest_1.expect)(result.fsStartAddress).toEqual(expectedFsStartAddress);
        (0, vitest_1.expect)(result.fsEndAddress).toEqual(expectedFsEndAddress);
        (0, vitest_1.expect)(result.uPyVersion).toEqual(expectedUPyVersion);
        (0, vitest_1.expect)(result.deviceVersion).toEqual(expectedDeviceVersion);
    });
    (0, vitest_1.it)('UICR data without MicroPython magic number', () => {
        const makeCodeUicr = ':020000041000EA\n' +
            ':0410140000C0030015\n' +
            ':040000050003C0C173\n' +
            ':00000001FF\n';
        const failCase = () => {
            (0, hex_mem_info_js_1.getIntelHexDeviceMemInfo)(makeCodeUicr);
        };
        (0, vitest_1.expect)(failCase).toThrow(Error);
    });
});
(0, vitest_1.describe)('Read MicroPython V2 flash regions data.', () => {
    const uPyHexFile = fs.readFileSync('./src/__tests__/upy-v2-beta-region.hex', 'utf8');
    (0, vitest_1.it)('Read MicroPython v2-beta-region hex file flash regions table', () => {
        const expectedPageSize = 4096;
        const expectedFlashSize = 512 * 1024;
        const MicroPythonLastByteUsed = 0x61f24;
        const expectedRuntimeEndPage = Math.ceil(MicroPythonLastByteUsed / expectedPageSize);
        const expectedFsStartAddress = 0x6d000;
        const expectedFsEndAddress = 0x73000;
        const expectedUpyVersion = 'micro:bit v2.0.99+b260810 on 2020-11-17; ' +
            'MicroPython b260810 on 2020-11-17';
        const result = (0, hex_mem_info_js_1.getIntelHexDeviceMemInfo)(uPyHexFile);
        (0, vitest_1.expect)(result.flashPageSize).toEqual(expectedPageSize);
        (0, vitest_1.expect)(result.flashSize).toEqual(expectedFlashSize);
        (0, vitest_1.expect)(result.flashStartAddress).toEqual(0);
        (0, vitest_1.expect)(result.flashEndAddress).toEqual(expectedFlashSize);
        (0, vitest_1.expect)(result.runtimeStartAddress).toEqual(0);
        (0, vitest_1.expect)(result.runtimeEndAddress).toEqual(expectedRuntimeEndPage * expectedPageSize);
        (0, vitest_1.expect)(result.fsStartAddress).toEqual(expectedFsStartAddress);
        (0, vitest_1.expect)(result.fsEndAddress).toEqual(expectedFsEndAddress);
        (0, vitest_1.expect)(result.uPyVersion).toEqual(expectedUpyVersion);
        (0, vitest_1.expect)(result.deviceVersion).toEqual('V2');
    });
});
//# sourceMappingURL=hex-mem-info.spec.js.map