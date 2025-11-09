export function readExifOrientation(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return null;
  if (view.getUint16(0, false) !== 0xffd8) return null; // JPEG magic

  let offset = 2;
  const length = view.byteLength;

  while (offset + 4 < length) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    // Safety: markers should start with 0xFF
    if ((marker & 0xff00) !== 0xff00) {
      break;
    }

    const size = view.getUint16(offset, false);
    offset += 2;

    if (marker === 0xffe1) {
      // APP1 marker where EXIF usually lives
      if (size < 8 || offset + size - 2 > length) {
        break;
      }

      const exifHeader = getAscii(view, offset, 4);
      if (exifHeader !== "Exif") {
        offset += size - 2;
        continue;
      }

      // Skip "Exif\0\0"
      const tiffOffset = offset + 6;
      if (tiffOffset + 8 > length) {
        break;
      }

      const endianness = getAscii(view, tiffOffset, 2);
      const littleEndian = endianness === "II";
      const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
      let dirStart = tiffOffset + firstIfdOffset;
      if (dirStart + 2 > length) {
        break;
      }

      const entries = view.getUint16(dirStart, littleEndian);
      dirStart += 2;

      for (let i = 0; i < entries; i++) {
        const entryOffset = dirStart + i * 12;
        if (entryOffset + 12 > length) {
          break;
        }

        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === 0x0112) {
          const valueOffset = entryOffset + 8;
          if (valueOffset + 2 > length) {
            return null;
          }
          const orientation = view.getUint16(valueOffset, littleEndian);
          return orientation;
        }
      }

      break;
    }

    offset += size - 2;
  }

  return null;
}

function getAscii(view: DataView, start: number, length: number) {
  let out = "";
  for (let i = 0; i < length; i++) {
    const code = view.getUint8(start + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}
