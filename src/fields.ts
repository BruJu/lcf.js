import Papa from "papaparse";
import fs from "fs";
import BinaryFileReader from "./binary_file_reader";
import toLCFSave from "./lcfsave";
import * as UnitReader from "./unit-reader";

/**
 * Translate the content of the given LCF file to a JS object
 * @param fields The `Field` object
 * @param path The path to the file to translate
 */
export function translate(fields: Fields, path: string) {
  const file = new BinaryFileReader(path);
  const size = file.readBERNumber();
  const initialType = file.readString(size);
  return fields.convert(file, initialType);
}

const FieldsCSVFix = {
  adaptType(type: string, isSizeField: string): [string, string] {
    if (isSizeField === 't') {
       return ["", "SizeField"];
    }

    let disposition = "";

    let vec = FieldsCSVFix.maybeExtract(type, "Vector");
    if (vec !== null) {
      disposition = vec[0]; type = vec[1];
    }
      
    vec = FieldsCSVFix.maybeExtract(type, "Array");
    if (vec !== null) {
      disposition = vec[0]; type = vec[1];
    }

    if (type.startsWith("Ref")) {
      type = "Number";
    }

    let pointpoint = type.split(":");
    if (pointpoint.length != 1) {
      type = pointpoint[1];

      if (type.startsWith("Ref")) {
        type = "Number";
      }
    }

    if (type === "Int32") {
      type = "Number";
    }

    if (type === 'EmptyBlock') type = "";

    return [disposition, type];
  },

  maybeExtract(type: string, str: string): [string, string] | null {
    if (type.startsWith(str)) {
      let t = type.substring(str.length + 1);
      return [str, t.substring(0, t.length - 1)]
    } else {
      return null;
    }
  },

  pickRM2k3Default(str: string): string {
    let split = str.split("|");
    return split[split.length - 1];
  }
};

export type LoadedCSVData = {
  Structure: string;
  Field: string;
  "Size Field?": string;
  Type: string;
  Index: string;
  "Default Value": string;
  "PersistIfDefault": string;
  "Is2k3": string;
  "Comment": string;
}

export type Field = LoadedCSVData & {
  Line: number;
  Disposition: string;
};

function loadedCsvDataToField(csvData: LoadedCSVData, lineNumber: number): Field {
  const trueDefault = FieldsCSVFix.pickRM2k3Default(csvData['Default Value']);
  
  const [disposition, type] = FieldsCSVFix.adaptType(csvData.Type, csvData['Size Field?']);

  const field = Object.assign({
    Line: lineNumber,
    Disposition: disposition
  }, csvData);

  field["Default Value"] = trueDefault;
  field.Type = type;

  return field;
}

export function _load_csv(path: string = "resource/fields_old.csv") {
  const input = fs.readFileSync(path, "utf-8");
  const csv = Papa.parse(input, { header: true });

  if (csv.errors.length !== 0) {
    console.error(csv.errors);
    throw Error("Error when parsing the fields.csv file");
  }

  let fields: Field[] = [];

  for (let i = 0 ; i != csv.data.length ; ++i) {
    fields.push(loadedCsvDataToField(csv.data[i] as LoadedCSVData, i + 1));
  }

  function change(structureName: string, fieldName: string, type: string, disposition: string) {
    let field = fields.find(field => field.Structure === structureName && field.Field === fieldName && field.Type !== 'SizeField');
    if (field === undefined) return;

    field.Type = type;
    field.Disposition = disposition;
  }

  change("Actor"     , "battle_commands", "UInt32", "Tuple_7");
  change("Class"     , "battle_commands", "UInt32", "Tuple_7");
  change("SaveActor" , "battle_commands", "UInt32", "Tuple_7");
  change("Parameters", "maxsp"  , "Int16", "Tuple_99");
  change("Parameters", "maxhp"  , "Int16", "Tuple_99");
  change("Parameters", "attack" , "Int16", "Tuple_99");
  change("Parameters", "defense", "Int16", "Tuple_99");
  change("Parameters", "spirit" , "Int16", "Tuple_99");
  change("Parameters", "agility", "Int16", "Tuple_99");
  change("EventCommand", "parameters", "Number", "List");
  change("TreeMap"     , "tree_order", "Number", "List");

  change("Database"     , "version", "Number", "");
  change("MoveRoute", "move_commands", "MoveCommandSpecial", "");

  change("Equipment", "weapon_id"   , "Int16", "");
  change("Equipment", "shield_id"   , "Int16", "");
  change("Equipment", "armor_id"    , "Int16", "");
  change("Equipment", "helmet_id"   , "Int16", "");
  change("Equipment", "accessory_id", "Int16", "");

  change("SaveSystem", "variables", "Int32", "Vector");

  return fields;
}

export type LCFEnum = {
  "#Structure": string;
  Entry: string;
  Value: string;
  Index: string;
};

function read_enums(path = __dirname + "/../resource/enums.csv") {
  const input = fs.readFileSync(path, "utf-8");
  const csv = Papa.parse<LCFEnum>(input, { header: true });

  if (csv.errors.length !== 0) {
    console.error(csv.errors);
    throw Error("Error when parsing the fields.csv file");
  }

  let structs: {[key: string]: [number, string][] } = {};

  for (const data of csv.data) {
    let key = data['#Structure'] + "_" + data.Entry;

    if (structs[key] === undefined) {
      structs[key] = [];
    }

    structs[key].push([parseInt(data.Index), data.Value]);
  }

  return structs;
}

/**
 * Reader for the `fields.csv` resource file
 */
export default class Fields {
  structures: {[name: string]: FieldReader<any>} = {};
  unknownTypes = new Set<string>();

  constructor(path = __dirname + "/../resource/fields_old.csv") {
    const csv = _load_csv(path);

    this.structures = {};

    this.unknownTypes = new Set()

    for (const [typeName, handler] of Object.entries(BasicTypeHandlers)) {
      this.structures[typeName] = new DefaultType(handler);
    };

    for (const [typeName, table] of Object.entries(read_enums())) {
      this.structures["Enum<" + typeName + ">"] = new EnumType_(typeName, table);
    }

    for (let field of csv) {
      if (this.structures[field.Structure] === undefined) {
        this.structures[field.Structure] = new Structure(this, field);
      }
    }
            
    for (let field of csv) {
      (this.structures[field.Structure] as Structure).addField(field);
    }
  }

  _print(structure: string) {
    console.error(this.structures[structure]);
  }

  /**
   * Return the name of the initial structure of the file
   * @param innerTypeDeclaration The type declared in the file as a
   * string.
   */
  static getInitialStructure(innerTypeDeclaration: string)
  : "Map" | "TreeMap" | "Database" | "Save" | undefined {
    if (innerTypeDeclaration === "LcfMapUnit")  return "Map";
    if (innerTypeDeclaration === "LcfMapTree")  return "TreeMap";
    if (innerTypeDeclaration === "LcfDataBase") return "Database";
    if (innerTypeDeclaration === "LcfSaveData") return "Save";
    return undefined;
  }

  convert(binary_file_reader: BinaryFileReader, initialType: string) {
    const structure = Fields.getInitialStructure(initialType);
    if (structure === undefined) {
      throw Error("Unknown initial type " + initialType);
    }

    const structureDefinition = this.structures[structure];
    if (structureDefinition === undefined) {
      throw Error("Unknown structure " + structure);
    }

    let rawData = structureDefinition.read(
      binary_file_reader, binary_file_reader.remaining_bytes()
    );

    if (initialType === "LcfSaveData") {
      return toLCFSave(rawData);
    } else {
      return rawData;
    }
  }

  makeHandler(disposition: string, type: string, canFail: boolean) {
    const singleElementHandler = this.getHandler(type, disposition === "" && canFail);
    
    if (singleElementHandler === undefined) {
      console.error("No handler for <<" + type + ">>");
      throw Error("No handler");
    }
    
    switch (disposition) {
      case ""      : return singleElementHandler;
      case "List"  : return UnitReader.readList(singleElementHandler);
      case "Vector": return UnitReader.readVector(singleElementHandler);
      case "Array" : return UnitReader.readArray(singleElementHandler);
    }
    
    if (disposition.startsWith("Tuple_")) {
      const quantity = parseInt(disposition.substring("Tuple_".length));
      return UnitReader.readTuple(singleElementHandler, quantity);
    }
  
    throw Error(`Unknown disposition: ${disposition}`);
  }

  getHandler(type: string, canFail: boolean) {
    const definition = this.structures[type];
    if (definition !== undefined) {
      return (reader: BinaryFileReader, size: number) => definition.read(reader, size);
    }
    
    this.unknownTypes.add(type);

    if (!canFail) return undefined;

    return (reader: BinaryFileReader, size: number) => {
      let bytes = [];
      for (let i = 0 ; i != size ; ++i) {
        bytes.push(reader.readNext());
      }
      return bytes;
    }
  }

  getListOfUnhandledTypes(): string[] {
    return [...this.unknownTypes];
  }
}

type FieldReader<T> = {
  read: DataProducer<T>;
};

/** Adapter of a function to the Structure interface */
class DefaultType<T> implements FieldReader<T> {
  constructor(handler: DataProducer<T>) {
    this.read = handler;
  }

  readonly read: DataProducer<T>;
}

class EnumType_ implements FieldReader<string> {
  readonly name: string;
  readonly table: Array<[number, string]>;

  constructor(typename: string, table: [number, string][]) {
    this.table = table;
    this.name = typename;
  }

  read(binary_file_reader: BinaryFileReader): string {
    let data = binary_file_reader.readBERNumber();

    let x = this.table.find(t => t[0] === data);

    if (x === undefined) {
      throw Error(`Unknown value for ${this.name}: ${data}`);
    }

    return x[1];
  }
}

type StructureField = {
  name: string;
  read: DataProducer<any>,
  Index: number;
  Type: string;
  DefaultValue: string;
};

class Structure {
  readonly FIELDS: Fields;
  readonly name: string;
  readonly read: DataProducer<any>;
  fields: StructureField[];

  constructor(FIELDS: Fields, firstField: Field) {
    /** The parent Fields object (fields.csv) */
    this.FIELDS = FIELDS;
    /** Name of the the structure */
    this.name = firstField.Structure;
    /** Read method */
    this.read = firstField.Index === "" ? this._readSerial : this._readByFields;
    /** The fields entries that composes this structure */
    this.fields = [];
  }

  addField(field: Field) {
    const expectedRead = field.Index === "" ? this._readSerial : this._readByFields;

    if (expectedRead !== this.read) {
        throw Error(`Structure ${this.name} have two incoherent fields Index wise`);
    }

    if (field.Type === "") return;

    let type = field.Type;
    if (type === "String") {
      type = field.Index === "" ? "SequentialString" : "BlockString";
    }

    let canFail = field.Index !== "";

    this.fields.push({
      name: field.Field,
      read: this.FIELDS.makeHandler(field.Disposition, type, canFail),
      Index: parseInt(field.Index, 16),
      Type: field.Type,
      DefaultValue: field['Default Value']
    });
  }

  _readSerial(binary_file_reader: BinaryFileReader) {
    const result: {[name: string]: any} = {};

    for (const field of this.fields) {
      result[field.name] = field.read(binary_file_reader, 0);
    }

    // TODO: check if all data have been consumed

    return result;
  }

  _readByFields(binary_file_reader: BinaryFileReader, allocated_bytes: number) {
    const result: {[name: string]: any} = {};

    const maxCursor = binary_file_reader.cursor + allocated_bytes;

    while (true) {
      if (binary_file_reader.isFinished() || binary_file_reader.cursor == maxCursor) break;
        
      const blockNumber = binary_file_reader.readBERNumber();
      if (blockNumber === 0) break;

      const size = binary_file_reader.readBERNumber();

      if (size !== 0) {
        const field = this.findField(blockNumber);
        if (field === undefined) throw Error(`Structure ${this.name} has no block ${blockNumber}`);

        if (result[field.name]) {
          console.error(binary_file_reader.cursor);
          throw Error(`The field ${field.name} appears twice.`);
        }

        result[field.name] = field.read(binary_file_reader, size)

        // Surprisingly, ignoring size fields works fine
        if (field.Type === 'SizeField') result[field.name] = undefined;
      }
    }

    return result;
  }

  findField(blockNumber: number) {
    return this.fields.find(field => field.Index === blockNumber);
  }
}

// ==== Field factory

type DataProducer<T = any> = (reader: BinaryFileReader, bytes: number) => T;

const BasicTypeHandlers
: {[name: string]: DataProducer<any>}
= {
  "SequentialString": (reader, _) => reader.readString(reader.readBERNumber()),
  "BlockString": (reader, bytes) => reader.readString(bytes),
  "Int8"  : UnitReader.readInt8,
  "Int16" : UnitReader.readInt16,
  "Int32" : UnitReader.readInt32,
  "UInt8" : UnitReader.readUInt8,
  "UInt16": UnitReader.readUInt16,
  "UInt32": UnitReader.readUInt32,
  "Boolean": UnitReader.readBoolean,
  "Number": UnitReader.readNumber,
  "SizeField": UnitReader.readSizeField
};
