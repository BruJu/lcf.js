import BinaryFileReader from "./binary_file_reader";


export type DataProducer<T> = (reader: BinaryFileReader, bytes: number) => T;

////////////////////////////////////////////////////////////////////////////////
// Primary types

export function readNumber(reader: BinaryFileReader, _: number) {
  return reader.readBERNumber();
}

export function readSizeField(reader: BinaryFileReader, _: number) {
  return reader.readBERNumber();
}

export const readInt8   = readWithView(1, dataview => dataview.getInt8(0));
export const readInt16  = readWithView(2, dataview => dataview.getInt16(0, true));
export const readInt32  = readWithView(4, dataview => dataview.getInt32(0, true));
export const readUInt8  = readWithView(1, dataview => dataview.getUint8(0));
export const readUInt16 = readWithView(2, dataview => dataview.getUint16(0, true));
export const readUInt32 = readWithView(4, dataview => dataview.getUint32(0, true));

export function readBoolean(reader: BinaryFileReader, _: number) {
  let v = reader.readNext();
  if (v === 0) return false;
  if (v === 1) return true;
  throw Error("Handlers::Boolean - Unknown value " + v);
}

function readWithView(size: number, finalizer: (dataView: DataView) => number) {
  return (reader: BinaryFileReader, _: number) => {
    let data = new Uint8Array(reader.rawData);
    let dataView = new DataView(data.buffer, reader.cursor, size);
    reader.cursor += size;
    return finalizer(dataView);
  }
}


////////////////////////////////////////////////////////////////////////////////
// Monads

export function readList<T>(singleElementProducer: DataProducer<T>): DataProducer<T[]> {
  return (reader: BinaryFileReader, _: number) => {
    const quantity = reader.readBERNumber();

    let l: T[] = [];
    for (let i = 0; i != quantity; ++i) {
      l.push(singleElementProducer(reader, 0));
    }
    return l;
  };
}

export function readTuple<T>(singleElementProducer: DataProducer<T>, quantity: number): DataProducer<T[]> {
  return (reader: BinaryFileReader, _: number) => {
    let l: T[] = [];
    for (let i = 0; i != quantity; ++i) {
      l.push(singleElementProducer(reader, 0));
    }
    return l;
  };
}

export function readVector<T>(singleElementProducer: DataProducer<T>): DataProducer<T[]> {
  return (reader: BinaryFileReader, size: number) => {
    let base = reader.cursor;

    let l = [];
    while (reader.cursor < base + size) {
      l.push(singleElementProducer(reader, 0));
    }
    return l;
  };
}

export function readArray<T>(singleElementProducer: DataProducer<T>): DataProducer<{[key: string]: T}> {
  return (reader: BinaryFileReader, _: number) => {
    const quantity = reader.readBERNumber();

    let l: {[key: string]: T} = {};
    for (let i = 0 ; i != quantity ; ++i) {
      const id = reader.readBERNumber();
      l[id] = singleElementProducer(reader, 0);
    }

    return l;
  };
}
