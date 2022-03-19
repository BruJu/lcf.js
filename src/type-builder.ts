import { Field } from "./fields";
import { DefaultMap } from "mnemonist";

export default function buildType(fields: Field[], focus: string) {
  const allStructures = groupByStructures(fields);

  const knownTypes = new Set(allStructures.map(x => x.structureName));
  const code = allStructures.find(s => s.structureName === focus)!.genTypeDeclaration(knownTypes);

  console.log(code);

  return 0;
}


function groupByStructures(fields: Field[]): StructuredFields[] {
  // Group by
  const structures = new DefaultMap<string, Field[]>(() => []);

  for (const field of fields) {
    const structureName = field.Structure;
    structures.get(structureName).push(field);
  }

  // Restructure
  const structuredFields: StructuredFields[] = [];

  for (const [name, fields] of structures) {
    const isSerial = fields.every(f => f.Index === "");
    const isIndexed = fields.every(f => f.Index !== "");

    if (isSerial !== !isIndexed) {
      throw Error(`${name} is both serialed and indexed`);
    }

    structuredFields.push(new StructuredFields(
      name,
      fields,
      isSerial ? 'linear' : 'indexed'
    ));
  }

  return structuredFields;
}

export type TypescriptedType = {
  name: string;
  dependencies: string[];

  declarationCode: string;
  initializerCode: string;
}

export class StructuredFields {
  readonly structureName: string;
  readonly fields: Field[];
  readonly type: 'linear' | 'indexed';

  constructor(structureName: string, fields: Field[], type: 'linear' | 'indexed') {
    this.structureName = structureName;
    this.fields = fields;
    this.type = type;
  }

  genTypeDeclaration(knownTypes: Set<string>) {
    let s = `export type ${this.structureName} = {`;
    for (const field of this.fields) {
      if (field["Size Field?"] === "t") continue;

      s += `\n  ${field.Field}: ${toTSType(field.Disposition, field.Type, knownTypes)};`
    }

    s += "\n};"

    return s;
  }
/*
  genInitializer(knownTypes: Set<string>) {
    let s = `export function generate${this.structureName}(reader: BinaryFileReader): ${this.structureName} {`;

    function handlerNameOf(field: Field): string {
      const typeHandler = () => {
        switch (field.Type) {
          case "Number":
          case "UInt8":
          case "UInt16": 
          case "UInt32":
          case "Int8":
          case "Int16":
          case "Int32":
          case "Double":
          case "String":
          case "Boolean":
          case "SizeField":
            return "UnitReader.read" + field.Type;
          default:
            if (!knownTypes.has(field.Type)) {
              console.log("???", field.Type);
            }
            
            return "generate" + field.Type;
        }
      }


    }

    if (this.type === "indexed") {

    } else {
      s += "\n  return {";
      for (const field of this.fields) {
        if (field["Size Field?"] !== "t") {
          s += `  ${field.Field}: ${handlerNameOf(field)}(reader, 0),`
        }
      }
      s += "  };";
    }

    s += "\n}";
    return s;
  }

  */
};


function toTSType(disposition: string, type: string, structures: Set<string>): string {
  let res = 
(() => {
  switch (type) {
    case "Number":
      return "number";
    case "UInt8":
    case "UInt16":
    case "UInt32":
    case "Int8":
    case "Int16":
    case "Int32":
    case "Double":
      return "number";
    case "String":
      return "string";
    case "Boolean":
      return "boolean";
    default:
      if (structures.has(type)) return type;
      console.log("???", type);
      return type;
  }
})();

  if (disposition !== "" && disposition !== "Array") {
    res += "[]";
  } else {
    
  }

  return res;
}
