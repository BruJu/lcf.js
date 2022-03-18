import * as fs from "fs";

/**
 * A class that parses an RPG Maker 2003 binary file and translates it
 */
export default class BinaryFileReader {
  readonly rawData: Buffer;
  cursor: number;

  constructor(path: string | { buffer: Buffer }) {
    if (typeof path === "string") {
      this.rawData = fs.readFileSync(path);
    } else {
      this.rawData = path.buffer;
    }
    this.cursor = 0;
  }

  /**
   * Read the following data by considering it is a BER encoded number.
   * 
   * A BER encoded number is a number that can be arbitrarly long. The highest
   * byte encodes whetever the next byte is part of this number.
   * 
   * @returns The value
   */
  readBERNumber() {
    let number = 0;

    while (true) {
      const value = this.rawData[this.cursor];

      ++this.cursor;

      number = number * 0x80 + (value & 0x7F);

      if ((value & 0x80) === 0) {
        break;
      }
    }

    return number;
  }

  /**
   * Read the following data by considering it is a string.
   * @param size The number of characters of the string
   * @returns The string
   */
  readString(size: number) {
    const buffer = Buffer.from(this.rawData.slice(this.cursor, this.cursor + size));
    this.cursor += size;
    return buffer.toString('latin1') // "ISO-8859-15"
  }

  readNext() {
    const value = this.rawData[this.cursor];
    ++this.cursor;
    return value;
  }

  remaining_bytes() {
    return this.rawData.length - this.cursor;
  }

  isFinished() {
    return this.rawData.length <= this.cursor;
  }
}
