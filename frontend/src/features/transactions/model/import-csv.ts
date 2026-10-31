const strict = (label: string) => new TextDecoder(label, { fatal: true });

// UTF-8 (BOM removed by the decoder) first; Windows-1252 (French bank exports) if the bytes are not valid UTF-8.
// A file mixing both is decoded line by line: a line is UTF-8 if it is valid UTF-8, Windows-1252 otherwise.
export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return strict('utf-8').decode(buffer);
  } catch {
    const legacy = new TextDecoder('windows-1252');
    const bytes = new Uint8Array(buffer);
    const lines: string[] = [];
    let start = 0;
    for (let i = 0; i <= bytes.length; i++) {
      if (i < bytes.length && bytes[i] !== 0x0a) continue;
      const line = bytes.subarray(start, i);
      try {
        lines.push(strict('utf-8').decode(line));
      } catch {
        lines.push(legacy.decode(line));
      }
      start = i + 1;
    }
    return lines.join('\n');
  }
}
