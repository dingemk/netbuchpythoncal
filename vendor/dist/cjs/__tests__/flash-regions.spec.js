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
const flashRegions = __importStar(require("../flash-regions.js"));
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Read MicroPython flash regions data.', () => {
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
        const result = flashRegions.getIntelHexFlashRegionsData(uPyHexFile);
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
//# sourceMappingURL=flash-regions.spec.js.map