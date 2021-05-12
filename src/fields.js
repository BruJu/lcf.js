const Papa = require("papaparse");
const fs = require("fs");

/**
 * Reader for the `fields.csv` resource file
 */
class Fields {
    constructor(path = "resource/fields_java.csv") {
        const input = fs.readFileSync(path, "utf-8");

        const csv = Papa.parse(input, { header: true });

        if (csv.errors.length !== 0) {
            throw Error("Error when parsing the fields.csv file");
        }

        this.structures = {};

        for (let field of csv.data) {
            if (this.structures[field.Structure] === undefined) {
                this.structures[field.Structure] = new Structure(this, field);
            }
        }
            
        for (let field of csv.data) {
            this.structures[field.Structure].addField(field);
        }
    }

    _print(structure) {
        console.error(this.structures[structure]);
    }

    /**
     * Return the name of the initial structure of the file
     * @param {String} innerTypeDeclaration The type declared in the file as a
     * string.
     */
    static getInitialStructure(innerTypeDeclaration) {
        if (innerTypeDeclaration === "LcfMapUnit")  return "Map";
        if (innerTypeDeclaration === "LcfMapTree")  return "TreeMap";
        if (innerTypeDeclaration === "LcfDataBase") return "Database";
        if (innerTypeDeclaration === "LcfSaveData") return "Save";
        return undefined;
    }

    /**
     * 
     * @param {BinaryFile} binary_file_reader 
     * @param {String} initialType 
     */
    convert(binary_file_reader, initialType) {
        const structure = Fields.getInitialStructure(initialType);

        const structureDefinition = this.structures[structure];
        if (structureDefinition === undefined) {
            throw Error("Unknown structure " + structure);
        }

        let data = structureDefinition.read(
            binary_file_reader, binary_file_reader.remaining_bytes()
        );

        return {
            type: initialType,
            data: data
        };
    }

    getHandler(type, index) {
        if (type === "String") {
            if (index === undefined) {
                return Handlers.String.ByBlock;
            } else {
                return Handlers.String.Sequential;
            }
        }

        if (["Int8", "Int16", "Int32", "Number", "UInt8", "UInt16", "UInt32", "Boolean", "SizeField", "Double"].find(t => t === type)) {
            return Handlers[type];
        }

        if (type.endsWith("_Flags") || type === "MoveCommandSpecial") {
            return Handlers.Int32;
        }
    
        const definition = this.structures[type];
        if (definition === undefined) return undefined;
        return (a, b) => definition.read(a, b);
    }
}

class Structure {
    constructor(FIELDS, firstField) {
        /** The parent Fields object (fields.csv) */
        this.FIELDS = FIELDS;
        /** Name of the the structure */
        this.name = firstField.Structure;
        /** Read method */
        this.read = firstField.Index === "" ? this._readSerial : this._readByFields;
        /** The fields entries that composes this structure */
        this.fields = [];
    }

    addField(field) {
        const expectedRead = field.Index === "" ? this._readSerial : this._readByFields;

        if (expectedRead !== this.read) {
            throw Error(`Structure ${this.name} have two incoherent fields Index wise`);
        }

        if (field.Type === "") return;

        this.fields.push({
            name: field.Field,
            read: makeHandler(this.FIELDS, field.Disposition, field.Type),
            Index: parseInt(field.Index, 16),
            DefaultValue: this.fields['Default Value']
        });
    }

    _readSerial(binary_file_reader, _allocated_bytes) {
        const result = [];

        for (const field of this.fields) {
            result.push(
                {
                    name: field.name,
                    data: field.read(binary_file_reader, undefined)
                }
            );
        }

        // TODO: check if all data have been consumed

        return result;
    }

    _readByFields(binary_file_reader, allocated_bytes) {
        const result = [];

        console.error("{" + this.name);

        const maxCursor = binary_file_reader.cursor + allocated_bytes;

        while (true) {
            if (binary_file_reader.isFinished() || binary_file_reader.cursor == maxCursor) break;
            
            const blockNumber = binary_file_reader.readBERNumber("Read block #");
            if (blockNumber === 0) break;

            const size = binary_file_reader.readBERNumber("Read size ");

            if (size !== 0) {
                const field = this.findField(blockNumber);
                if (field === undefined) throw Error(`Structure ${this.name} has no block ${blockNumber}`);
                result.push(
                    {
                        name: field.name,
                        data: field.read(binary_file_reader, size)
                    }
                )
            }
        }

        console.error("}");

        return result;
    }

    findField(blockNumber) {
        for (const field of this.fields) {
            console.error(field.Index);
            break;
        }
        return this.fields.find(field => field.Index === blockNumber);
    }
}

// ==== Field factory

function makeHandler(FIELDS, disposition, type, index) {
    const singleElementHandler = FIELDS.getHandler(type, index);

    if (singleElementHandler === undefined) {
        console.error("No handler for <<" + type + ">>");
        throw Error("No handler");
    }

    switch (disposition) {
        case ""      : return handlerSingle(singleElementHandler);
        case "List"  : return handlerList  (singleElementHandler);
        case "Vector": return handlerVector(singleElementHandler);
        case "Array" : return handlerArray (singleElementHandler);
    }

    if (disposition.startsWith("Tuple_")) {
        const quantity = parseInt(disposition.substr("Tuple_".length));
        return handlerTuple(singleElementHandler, quantity);
    }

    throw Error(`Unknown disposition: ${disposition}`);
}

function handlerList(singleElementHandler) {
    return (reader, _) => {
        const quantity = reader.readBERNumber();

        let l = [];
        for (let i = 0 ; i != quantity ; ++i) {
            l.push(singleElementHandler(reader, undefined));
        }

        return l;
    }
}


function handlerTuple(singleElementHandler, quantity) {
    return (reader, _) => {
        let l = [];
        for (let i = 0 ; i != quantity ; ++i) {
            l.push(singleElementHandler(reader, undefined));
        }

        return l;
    }
}

function handlerVector(singleElementHandler) {
    return (reader, size) => {
        let base = reader.cursor;

        let l = [];
        while (reader.cursor < base + size) {
            l.push(singleElementHandler(reader, undefined));
        }
        return l;
    }
}

function handlerArray(singleElementHandler) {
    return (reader, _) => {
        const quantity = reader.readBERNumber();

        let l = {};
        for (let i = 0 ; i != quantity ; ++i) {
            const id = reader.readBERNumber();
            l[id] = singleElementHandler(reader, undefined);
        }

        return l;
    }
}

const Handlers = {
    "String": {
        ByBlock: (reader, bytes) => reader.readString(bytes),
        Sequential: (reader, _) => reader.readString(reader.readBERNumber())
    },
    "Int8": makeHandlerForInt(1, dataview => dataview.getInt8(0)),
    "Int16": makeHandlerForInt(2, dataview => dataview.getInt16(0, true)),
    "Int32": makeHandlerForInt(4, dataview => dataview.getInt32(0, true)),
    "UInt8": makeHandlerForUInt(1),
    "UInt16": makeHandlerForUInt(2),
    "UInt32": makeHandlerForUInt(4),
    "Boolean": (reader, _) => {
        let v = reader.readNext();
        if (v === 0) return false;
        if (v === 1) return true;
        throw Error("Handlers::Boolean - Unknown value " + v);
    },
    "Number": (reader, _) => reader.readBERNumber(),
    "SizeField": (reader, _) => reader.readBERNumber(),
    "Double": (reader, o) => {
        reader.cursor += o;
        return "";
    }
};

function extract(reader, size) {
    let bytes = [];
    for (let i = 0 ; i != size ; ++i) {
        bytes.push(reader.readNext());
    }
    return bytes;
}

function makeHandlerForInt(size, finalizer) {
    return (reader, _) => {
        let bytes = extract(reader, size);
        let data = new Uint8Array(bytes);
        let dataView = new DataView(data.buffer);
        return finalizer(dataView);
    }
}

function makeHandlerForUInt(size) {
    return (reader, _) => {
        let bytes = extract(reader, size);
        let v = 0;
        for (const byte of bytes) {
            v = v * 0x100 + byte;
        }
        return v;
    }
}

function handlerSingle(singleElementHandler) {
    return singleElementHandler;
}


//

module.exports = Fields;

// For definition only
const BinaryFile = require("./binary_file_reader");const { exit } = require("process");

