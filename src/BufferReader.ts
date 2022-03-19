/**
 * A class that parses an RPG Maker 2003 binary file and translates it
 */
export default class BufferReader {
  readonly rawData: Buffer;
  cursor: number;

  constructor(buffer: Buffer) {
    this.rawData = buffer;
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

////////////////////////////////////////////////////////////////////////////////


export type DataProducer<T> = (reader: BufferReader, bytes: number) => T;

////////////////////////////////////////////////////////////////////////////////
// Primary types

export function readNumber(reader: BufferReader, _: number) {
  return reader.readBERNumber();
}

export function readSizeField(reader: BufferReader, _: number) {
  return reader.readBERNumber();
}

export const readInt8   = readWithView(1, dataview => dataview.getInt8(0));
export const readInt16  = readWithView(2, dataview => dataview.getInt16(0, true));
export const readInt32  = readWithView(4, dataview => dataview.getInt32(0, true));
export const readUInt8  = readWithView(1, dataview => dataview.getUint8(0));
export const readUInt16 = readWithView(2, dataview => dataview.getUint16(0, true));
export const readUInt32 = readWithView(4, dataview => dataview.getUint32(0, true));

export function readBoolean(reader: BufferReader, _: number) {
  let v = reader.readNext();
  if (v === 0) return false;
  if (v === 1) return true;
  throw Error("Handlers::Boolean - Unknown value " + v);
}

function readWithView(size: number, finalizer: (dataView: DataView) => number) {
  return (reader: BufferReader, _: number) => {
    let data = new Uint8Array(reader.rawData);
    let dataView = new DataView(data.buffer, reader.cursor, size);
    reader.cursor += size;
    return finalizer(dataView);
  }
}


////////////////////////////////////////////////////////////////////////////////
// Monads

export function readList<T>(singleElementProducer: DataProducer<T>): DataProducer<T[]> {
  return (reader: BufferReader, _: number) => {
    const quantity = reader.readBERNumber();

    let l: T[] = [];
    for (let i = 0; i != quantity; ++i) {
      l.push(singleElementProducer(reader, 0));
    }
    return l;
  };
}

export function readTuple<T>(singleElementProducer: DataProducer<T>, quantity: number): DataProducer<T[]> {
  return (reader: BufferReader, _: number) => {
    let l: T[] = [];
    for (let i = 0; i != quantity; ++i) {
      l.push(singleElementProducer(reader, 0));
    }
    return l;
  };
}

export function readVector<T>(singleElementProducer: DataProducer<T>): DataProducer<T[]> {
  return (reader: BufferReader, size: number) => {
    let base = reader.cursor;

    let l = [];
    while (reader.cursor < base + size) {
      l.push(singleElementProducer(reader, 0));
    }
    return l;
  };
}

export function readArray<T>(singleElementProducer: DataProducer<T>): DataProducer<{[key: string]: T}> {
  return (reader: BufferReader, _: number) => {
    const quantity = reader.readBERNumber();

    let l: {[key: string]: T} = {};
    for (let i = 0 ; i != quantity ; ++i) {
      const id = reader.readBERNumber();
      l[id] = singleElementProducer(reader, 0);
    }

    return l;
  };
}

