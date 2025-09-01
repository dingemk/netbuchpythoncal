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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHexMapFlashRegionsData = getHexMapFlashRegionsData;
exports.getIntelHexFlashRegionsData = getIntelHexFlashRegionsData;
/**
 * Interprets the Flash Regions Table stored in flash.
 *
 * The micro:bit flash layout is divided in flash regions, each containing a
 * different type of data (Nordic SoftDevice, MicroPython, bootloader, etc).
 * One of the regions is dedicated to the micro:bit filesystem, and this info
 * is used by this library to add the user files into a MicroPython hex File.
 *
 * The Flash Regions Table stores a data table at the end of the last flash page
 * used by the MicroPython runtime.
 * The table contains a series of 16-byte rows with info about each region
 * and it ends with a 16-byte table header with info about the table itself.
 * All in little-endian format.
 *
 * ```
 * |                                                               | Low address
 * | ID| HT|1ST_PAG| REGION_LENGTH | HASH_DATA                     | Row 1
 * | ID| HT|1ST_PAG| REGION_LENGTH | HASH_DATA                     | ...
 * | ID| HT|1ST_PAG| REGION_LENGTH | HASH_DATA                     | Row N
 * | MAGIC_1       | VER   | T_LEN |REG_CNT| P_SIZE| MAGIC_2       | Header
 * |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---| Page end
 * |0x0|0x1|0x2|0x3|0x4|0x5|0x6|0x7|0x8|0x9|0xa|0xb|0xc|0xd|0xe|0xf|
 * |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
 * ```
 *
 * More information about how this data is added to the MicroPython Intel Hex
 * file can be found in the MicroPython for micro:bit v2 repository:
 *   https://github.com/microbit-foundation/micropython-microbit-v2/blob/v2.0.0-beta.3/src/addlayouttable.py
 *
 * @packageDocumentation
 *
 * (c) 2020 Micro:bit Educational Foundation and the microbit-fs contributors.
 * SPDX-License-Identifier: MIT
 */
const nrf_intel_hex_1 = __importDefault(require("nrf-intel-hex"));
const common_js_1 = require("./common.js");
const hexMapUtil = __importStar(require("./hex-map-utils.js"));
/** Indicates the data contain in each of the different regions */
var RegionId;
(function (RegionId) {
    /** Soft Device is the data blob containing the Nordic Bluetooth stack. */
    RegionId[RegionId["softDevice"] = 1] = "softDevice";
    /** Contains the MicroPython runtime. */
    RegionId[RegionId["microPython"] = 2] = "microPython";
    /** Contains the MicroPython microbit filesystem reserved flash. */
    RegionId[RegionId["fs"] = 3] = "fs";
})(RegionId || (RegionId = {}));
/**
 * The "hash type" field in a region row indicates how to interpret the "hash
 * data" field.
 */
var RegionHashType;
(function (RegionHashType) {
    /** The hash data is empty. */
    RegionHashType[RegionHashType["empty"] = 0] = "empty";
    /** The full hash data field is used as a hash of the region in flash */
    RegionHashType[RegionHashType["data"] = 1] = "data";
    /** The 4 LSB bytes of the hash data field are used as a pointer  */
    RegionHashType[RegionHashType["pointer"] = 2] = "pointer";
})(RegionHashType || (RegionHashType = {}));
// Sizes for each of the fields in the Flash Regions Table header
const MAGIC2_LEN_BYTES = 4;
const P_SIZE_LOG2_LEN_BYTES = 2;
const NUM_REG_LEN_BYTES = 2;
const TABLE_LEN_LEN_BYTES = 2;
const VERSION_LEN_BYTES = 2;
const MAGIC_1_LEN_BYTES = 4;
/**
 * Offset for each of the Table header fields, starting from the end of the row.
 *
 * These are the fields stored in each row for each of the regions, and
 * any additional region data from the Region interface is derived from this.
 *
 * |0x00|..|..|0x03|0x04|0x05|0x06|0x07|0x08|0x09|0x0a|0x0b|0x0c|..|..|0x0f|
 * |----|--|--|----|----|----|----|----|----|----|----|----|----|--|--|----|
 * | MAGIC_1       | VERSION |TABLE_LEN|REG_COUNT| P_SIZE  | MAGIC_2       |
 */
var RegionHeaderOffset;
(function (RegionHeaderOffset) {
    RegionHeaderOffset[RegionHeaderOffset["magic2"] = 4] = "magic2";
    RegionHeaderOffset[RegionHeaderOffset["pageSizeLog2"] = 6] = "pageSizeLog2";
    RegionHeaderOffset[RegionHeaderOffset["regionCount"] = 8] = "regionCount";
    RegionHeaderOffset[RegionHeaderOffset["tableLength"] = 10] = "tableLength";
    RegionHeaderOffset[RegionHeaderOffset["version"] = 12] = "version";
    RegionHeaderOffset[RegionHeaderOffset["magic1"] = 16] = "magic1";
})(RegionHeaderOffset || (RegionHeaderOffset = {}));
// Magic numbers to identify the Flash Regions Table in flash
const REGION_HEADER_MAGIC_1 = 0x597f30fe;
const REGION_HEADER_MAGIC_2 = 0xc1b1d79d;
// Sizes for each of the fields in each Region row from the Flash Regions Table
const REGION_ID_BYTES = 1;
const REGION_HASH_TYPE_BYTES = 1;
const REGION_START_PAGE_BYTES = 2;
const REGION_LEN_BYTES = 4;
const REGION_HASH_DATA_BYTES = 8;
/**
 * Offset for each of the Region row fields, starting from the end of the row.
 *
 * These are the fields stored in each row for each of the regions, and
 * any additional region data from the Region interface is derived from this.
 *
 * |0x00|0x01|0x02|0x03|0x04|0x05|0x06|0x07|0x08|..|..|..|..|..|..|0x0f|
 * |----|----|----|----|----|----|----|----|----|--|--|--|--|--|--|----|
 * | ID | HT |1ST_PAGE | REGION_LENGTH     | HASH_DATA                 |
 */
var RegionRowOffset;
(function (RegionRowOffset) {
    RegionRowOffset[RegionRowOffset["hashData"] = 8] = "hashData";
    RegionRowOffset[RegionRowOffset["lengthBytes"] = 12] = "lengthBytes";
    RegionRowOffset[RegionRowOffset["startPage"] = 14] = "startPage";
    RegionRowOffset[RegionRowOffset["hashType"] = 15] = "hashType";
    RegionRowOffset[RegionRowOffset["id"] = 16] = "id";
})(RegionRowOffset || (RegionRowOffset = {}));
const REGION_ROW_LEN_BYTES = RegionRowOffset.id;
/**
 * Iterates through the provided Intel Hex Memory Map and tries to find the
 * Flash Regions Table header, by looking for the magic values at the end of
 * each flash page.
 *
 * TODO: Indicate here what errors can be thrown.
 *
 * @param iHexMap - Intel Hex memory map to scan for the Flash Regions Table.
 * @param pSize - Flash page size to scan at the end of each page.
 * @returns The table header data.
 */
function getTableHeader(iHexMap, pSize = 1024) {
    let endAddress = 0;
    const magic1ToFind = new Uint8Array(new Uint32Array([REGION_HEADER_MAGIC_1]).buffer);
    const magic2ToFind = new Uint8Array(new Uint32Array([REGION_HEADER_MAGIC_2]).buffer);
    const mapEntries = iHexMap.paginate(pSize, 0xff).entries();
    for (let iter = mapEntries.next(); !iter.done; iter = mapEntries.next()) {
        if (!iter.value)
            continue;
        const blockByteArray = iter.value[1];
        const subArrayMagic2 = blockByteArray.subarray(-RegionHeaderOffset.magic2);
        if ((0, common_js_1.areUint8ArraysEqual)(subArrayMagic2, magic2ToFind) &&
            (0, common_js_1.areUint8ArraysEqual)(blockByteArray.subarray(-RegionHeaderOffset.magic1, -(RegionHeaderOffset.magic1 - MAGIC_1_LEN_BYTES)), magic1ToFind)) {
            const pageStartAddress = iter.value[0];
            endAddress = pageStartAddress + pSize;
            break;
        }
    }
    // TODO: Throw an error if table is not found.
    const version = hexMapUtil.getUint16(iHexMap, endAddress - RegionHeaderOffset.version);
    const tableLength = hexMapUtil.getUint16(iHexMap, endAddress - RegionHeaderOffset.tableLength);
    const regionCount = hexMapUtil.getUint16(iHexMap, endAddress - RegionHeaderOffset.regionCount);
    const pageSizeLog2 = hexMapUtil.getUint16(iHexMap, endAddress - RegionHeaderOffset.pageSizeLog2);
    const pageSize = Math.pow(2, pageSizeLog2);
    const startAddress = endAddress - RegionHeaderOffset.magic1;
    return {
        pageSizeLog2,
        pageSize,
        regionCount,
        tableLength,
        version,
        endAddress,
        startAddress,
    };
}
/**
 * Parses a Region rows from a Flash Regions Table inside the Intel Hex memory
 * map, which ends at the provided rowEndAddress.
 *
 * Since the Flash Regions Table is placed at the end of a page, we iterate
 * from the end to the beginning.
 *
 * @param iHexMap - Intel Hex memory map to scan for the Flash Regions Table.
 * @param rowEndAddress - Address at which the row ends (same as the address
 *    where the next row or table header starts).
 * @returns The Region info from the row.
 */
function getRegionRow(iHexMap, rowEndAddress) {
    const id = hexMapUtil.getUint8(iHexMap, rowEndAddress - RegionRowOffset.id);
    const hashType = hexMapUtil.getUint8(iHexMap, rowEndAddress - RegionRowOffset.hashType);
    const hashData = hexMapUtil.getUint64(iHexMap, rowEndAddress - RegionRowOffset.hashData);
    let hashPointerData = '';
    if (hashType === RegionHashType.pointer) {
        // Pointer to a string in the hex is only 4 bytes instead of 8
        hashPointerData = hexMapUtil.getString(iHexMap, hashData & 0xffffffff);
    }
    const startPage = hexMapUtil.getUint16(iHexMap, rowEndAddress - RegionRowOffset.startPage);
    const lengthBytes = hexMapUtil.getUint32(iHexMap, rowEndAddress - RegionRowOffset.lengthBytes);
    return {
        id,
        startPage,
        lengthBytes,
        hashType,
        hashData,
        hashPointerData,
    };
}
/**
 * Reads the Flash Regions Table data from an Intel Hex map and retrieves the
 * MicroPython DeviceMemInfo data.
 *
 * @throws {Error} When the Magic Header is not present.
 * @throws {Error} When the MicroPython or FS regions are not found.
 *
 * @param intelHexMap - Memory map of the Intel Hex to scan.
 * @returns Object with the parsed data from the Flash Regions Table.
 */
function getHexMapFlashRegionsData(iHexMap) {
    // TODO: There is currently have some "internal" knowledge here and it's
    // scanning the flash knowing the page size is 4 KBs
    const tableHeader = getTableHeader(iHexMap, 4096);
    const regionRows = {};
    for (let i = 0; i < tableHeader.regionCount; i++) {
        const rowEndAddress = tableHeader.startAddress - i * REGION_ROW_LEN_BYTES;
        const regionRow = getRegionRow(iHexMap, rowEndAddress);
        regionRows[regionRow.id] = regionRow;
    }
    if (!regionRows.hasOwnProperty(RegionId.microPython)) {
        throw new Error('Could not find a MicroPython region in the regions table.');
    }
    if (!regionRows.hasOwnProperty(RegionId.fs)) {
        throw new Error('Could not find a File System region in the regions table.');
    }
    // Have to manually set the start at address 0 even if regions don't cover it
    const runtimeStartAddress = 0;
    let runtimeEndAddress = regionRows[RegionId.microPython].startPage * tableHeader.pageSize +
        regionRows[RegionId.microPython].lengthBytes;
    // The table is placed at the end of the last page used by MicroPython and we
    // need to include it
    runtimeEndAddress = tableHeader.endAddress;
    const uPyVersion = regionRows[RegionId.microPython].hashPointerData;
    const fsStartAddress = regionRows[RegionId.fs].startPage * tableHeader.pageSize;
    const fsEndAddress = fsStartAddress + regionRows[RegionId.fs].lengthBytes;
    return {
        flashPageSize: tableHeader.pageSize,
        flashSize: 512 * 1024,
        flashStartAddress: 0,
        flashEndAddress: 512 * 1024,
        runtimeStartAddress,
        runtimeEndAddress,
        fsStartAddress,
        fsEndAddress,
        uPyVersion,
        deviceVersion: 'V2',
    };
}
/**
 * Reads the Flash Regions Table data from an Intel Hex map and retrieves the
 * MicroPython DeviceMemInfo data.
 *
 * @throws {Error} When the Magic Header is not present.
 * @throws {Error} When the MicroPython or FS regions are not found.
 *
 * @param intelHex - MicroPython Intel Hex string.
 * @returns Object with the parsed data from the Flash Regions Table.
 */
function getIntelHexFlashRegionsData(intelHex) {
    return getHexMapFlashRegionsData(nrf_intel_hex_1.default.fromHex(intelHex));
}
//# sourceMappingURL=flash-regions.js.map