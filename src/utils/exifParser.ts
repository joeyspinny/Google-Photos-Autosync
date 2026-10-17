export interface ParsedExif {
  fileName: string;
  fileSize: number;
  mimeType: string;
  hasExif: boolean;
  make?: string;
  model?: string;
  dateTimeOriginal?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: string;
  latitude?: number;
  longitude?: number;
  rawTags: Record<string, string>;
}

export function parseExifFromArrayBuffer(buffer: ArrayBuffer, fileName: string, mimeType: string): ParsedExif {
  const result: ParsedExif = {
    fileName,
    fileSize: buffer.byteLength,
    mimeType,
    hasExif: false,
    rawTags: {},
  };

  const dataView = new DataView(buffer);

  // Check for JPEG SOI (0xFFD8)
  if (dataView.byteLength < 4) return result;
  if (dataView.getUint16(0, false) !== 0xffd8) {
    // Not a standard JPEG SOI, may still have filename and size
    return result;
  }

  let offset = 2;
  const length = dataView.byteLength;

  while (offset < length - 2) {
    const marker = dataView.getUint16(offset, false);
    offset += 2;

    if (marker === 0xffe1) {
      // APP1 Marker (Exif)
      const app1Length = dataView.getUint16(offset, false);
      const exifHeader = dataView.getUint32(offset + 2, false);

      // Check "Exif\0\0"
      if (exifHeader === 0x45786966) {
        result.hasExif = true;
        parseTiffHeader(dataView, offset + 8, result);
        break;
      }
      offset += app1Length;
    } else if ((marker & 0xff00) === 0xff00) {
      if (marker === 0xffda || marker === 0xffd9) {
        // Start of scan or End of image
        break;
      }
      const sectionLength = dataView.getUint16(offset, false);
      offset += sectionLength;
    } else {
      offset++;
    }
  }

  return result;
}

function parseTiffHeader(view: DataView, tiffOffset: number, result: ParsedExif) {
  if (tiffOffset + 8 > view.byteLength) return;

  const byteOrderMarker = view.getUint16(tiffOffset, false);
  const littleEndian = byteOrderMarker === 0x4949; // "II" for Intel, "MM" for Motorola

  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  if (firstIfdOffset < 8) return;

  parseIfd(view, tiffOffset, tiffOffset + firstIfdOffset, littleEndian, result);
}

function parseIfd(
  view: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
  result: ParsedExif
) {
  if (ifdOffset + 2 > view.byteLength) return;

  const entries = view.getUint16(ifdOffset, littleEndian);
  let exifSubIfdOffset = 0;
  let gpsSubIfdOffset = 0;

  for (let i = 0; i < entries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    if (tag === 0x010f) {
      // Make
      result.make = readAscii(view, tiffOffset, valueOffset, count, littleEndian);
    } else if (tag === 0x0110) {
      // Model
      result.model = readAscii(view, tiffOffset, valueOffset, count, littleEndian);
    } else if (tag === 0x8769) {
      // Exif IFD Pointer
      exifSubIfdOffset = view.getUint32(valueOffset, littleEndian);
    } else if (tag === 0x8825) {
      // GPS IFD Pointer
      gpsSubIfdOffset = view.getUint32(valueOffset, littleEndian);
    }
  }

  // Parse Exif Sub-IFD
  if (exifSubIfdOffset > 0) {
    parseExifSubIfd(view, tiffOffset, tiffOffset + exifSubIfdOffset, littleEndian, result);
  }

  // Parse GPS Sub-IFD
  if (gpsSubIfdOffset > 0) {
    parseGpsSubIfd(view, tiffOffset, tiffOffset + gpsSubIfdOffset, littleEndian, result);
  }
}

function parseExifSubIfd(
  view: DataView,
  tiffOffset: number,
  subIfdOffset: number,
  littleEndian: boolean,
  result: ParsedExif
) {
  if (subIfdOffset + 2 > view.byteLength) return;
  const entries = view.getUint16(subIfdOffset, littleEndian);

  for (let i = 0; i < entries; i++) {
    const entryOffset = subIfdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    if (tag === 0x9003 || tag === 0x9004) {
      // DateTimeOriginal / DateTimeDigitized
      const dt = readAscii(view, tiffOffset, valueOffset, count, littleEndian);
      if (dt) result.dateTimeOriginal = dt;
    } else if (tag === 0x829a) {
      // ExposureTime
      result.exposureTime = readRational(view, tiffOffset, valueOffset, littleEndian);
    } else if (tag === 0x829d) {
      // FNumber
      result.fNumber = readRational(view, tiffOffset, valueOffset, littleEndian);
    } else if (tag === 0x8827) {
      // ISO
      const isoVal = view.getUint16(valueOffset, littleEndian);
      result.iso = isoVal.toString();
    }
  }
}

function parseGpsSubIfd(
  view: DataView,
  tiffOffset: number,
  gpsOffset: number,
  littleEndian: boolean,
  result: ParsedExif
) {
  if (gpsOffset + 2 > view.byteLength) return;
  const entries = view.getUint16(gpsOffset, littleEndian);
  let latRef = "N";
  let lonRef = "E";
  let latDms: number[] = [];
  let lonDms: number[] = [];

  for (let i = 0; i < entries; i++) {
    const entryOffset = gpsOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const valueOffset = entryOffset + 8;

    if (tag === 1) {
      // GPSLatitudeRef
      latRef = String.fromCharCode(view.getUint8(valueOffset));
    } else if (tag === 2) {
      // GPSLatitude (3 rationals)
      latDms = readRationalArray(view, tiffOffset, valueOffset, 3, littleEndian);
    } else if (tag === 3) {
      // GPSLongitudeRef
      lonRef = String.fromCharCode(view.getUint8(valueOffset));
    } else if (tag === 4) {
      // GPSLongitude (3 rationals)
      lonDms = readRationalArray(view, tiffOffset, valueOffset, 3, littleEndian);
    }
  }

  if (latDms.length === 3) {
    let lat = latDms[0] + latDms[1] / 60 + latDms[2] / 3600;
    if (latRef === "S") lat = -lat;
    result.latitude = parseFloat(lat.toFixed(6));
  }

  if (lonDms.length === 3) {
    let lon = lonDms[0] + lonDms[1] / 60 + lonDms[2] / 3600;
    if (lonRef === "W") lon = -lon;
    result.longitude = parseFloat(lon.toFixed(6));
  }
}

function readAscii(view: DataView, tiffOffset: number, offsetVal: number, count: number, littleEndian: boolean): string {
  let actualOffset = count <= 4 ? offsetVal : tiffOffset + view.getUint32(offsetVal, littleEndian);
  if (actualOffset + count > view.byteLength) return "";
  let str = "";
  for (let i = 0; i < count; i++) {
    const charCode = view.getUint8(actualOffset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}

function readRational(view: DataView, tiffOffset: number, offsetVal: number, littleEndian: boolean): string {
  const actualOffset = tiffOffset + view.getUint32(offsetVal, littleEndian);
  if (actualOffset + 8 > view.byteLength) return "";
  const num = view.getUint32(actualOffset, littleEndian);
  const den = view.getUint32(actualOffset + 4, littleEndian);
  if (den === 0) return "0";
  if (num === 1) return `1/${den}`;
  return (num / den).toFixed(1);
}

function readRationalArray(view: DataView, tiffOffset: number, offsetVal: number, count: number, littleEndian: boolean): number[] {
  const actualOffset = tiffOffset + view.getUint32(offsetVal, littleEndian);
  const arr: number[] = [];
  for (let i = 0; i < count; i++) {
    const itemOffset = actualOffset + i * 8;
    if (itemOffset + 8 > view.byteLength) break;
    const num = view.getUint32(itemOffset, littleEndian);
    const den = view.getUint32(itemOffset + 4, littleEndian);
    arr.push(den === 0 ? 0 : num / den);
  }
  return arr;
}
