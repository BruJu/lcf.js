const Papa = require("papaparse");
const fs = require("fs");

const FieldsCSVFix = {
    adaptType: function(type, isSizeField) {
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

        if (type.startsWith("Enum")) {
            type = "Number";
        }

        if (type === "Int32") {
            type = "Number";
        }

        if (type === 'EmptyBlock') type = "";

        return [disposition, type];
    },
    maybeExtract: function(type, str) {
        if (type.startsWith(str)) {
            let t = type.substr(str.length + 1);
            return [str, t.substr(0, t.length - 1)]
        } else {
            return null;
        }
    },
    pickRM2k3Default(str) {
        let split = str.split("|");
        return split[split.length - 1];
    }

};

function _load_csv(path = "resource/fields_old.csv") {
    const input = fs.readFileSync(path, "utf-8");
    const csv = Papa.parse(input, { header: true });

    if (csv.errors.length !== 0) {
        console.error(csv.errors);
        throw Error("Error when parsing the fields.csv file");
    }

    for (let i = 0 ; i != csv.data.length ; ++i) {
        // Add line number for equality (TODO: remove)
        const data = csv.data[i];
        data.Line = i + 1;

        data['Default Value'] = FieldsCSVFix.pickRM2k3Default(data['Default Value']);

        // Adapt the type
        const [disposition, type] = FieldsCSVFix.adaptType(data.Type, data['Size Field?']);
        data.Disposition = disposition;
        data.Type = type;
    }

    function change(structureName, fieldName, type, disposition) {
        let field = csv.data.find(field => field.Structure === structureName && field.Field === fieldName && field.Type !== 'SizeField');
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

    return csv.data;
}

/**
 * Reader for the `fields.csv` resource file
 */
class Fields {
    constructor(path = "resource/fields_old.csv") {
        const csv = _load_csv(path);

        this.structures = {};

        this.unknownTypes = new Set()

        for (const [typeName, handler] of Object.entries(BasicTypeHandlers)) {
            this.structures[typeName] = new DefaultType(handler);
        };

        for (let field of csv) {
            if (this.structures[field.Structure] === undefined) {
                this.structures[field.Structure] = new Structure(this, field);
            }
        }
            
        for (let field of csv) {
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

        return structureDefinition.read(
            binary_file_reader, binary_file_reader.remaining_bytes()
        );
    }

    makeHandler(disposition, type, canFail) {
        const singleElementHandler = this.getHandler(type, disposition === "" && canFail);
    
        if (singleElementHandler === undefined) {
            console.error("No handler for <<" + type + ">>");
            throw Error("No handler");
        }
    
        switch (disposition) {
            case ""      : return singleElementHandler;
            case "List"  : return DispositionHandlers.List  (singleElementHandler);
            case "Vector": return DispositionHandlers.Vector(singleElementHandler);
            case "Array" : return DispositionHandlers.Array (singleElementHandler);
        }
    
        if (disposition.startsWith("Tuple_")) {
            const quantity = parseInt(disposition.substr("Tuple_".length));
            return DispositionHandlers.Tuple(singleElementHandler, quantity);
        }
    
        throw Error(`Unknown disposition: ${disposition}`);
    }

    getHandler(type, canFail) {
        const definition = this.structures[type];
        if (definition !== undefined) {
            return (reader, size) => definition.read(reader, size);
        }
        
        this.unknownTypes.add(type);

        if (!canFail) return undefined;

        return (reader, size) => {
            let bytes = [];
            for (let i = 0 ; i != size ; ++i) {
                bytes.push(reader.readNext());
            }
            return bytes;
        }
    }

    getListOfUnhandledTypes() {
        return [...this.unknownTypes];
    }
}

/** Adapter of a function to the Structure interface */
class DefaultType {
    constructor(handler) {
        this.read = handler;
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

        let type = field.Type;
        if (type === "String") {
            type = type.Index === "" ? "SequentialString" : "BlockString";
        }
        let canFail = type.Index !== "";

        this.fields.push({
            name: field.Field,
            read: this.FIELDS.makeHandler(field.Disposition, type, canFail),
            Index: parseInt(field.Index, 16),
            Type: field.Type,
            DefaultValue: this.fields['Default Value']
        });
    }

    _readSerial(binary_file_reader, _allocated_bytes) {
        const result = {};

        for (const field of this.fields) {
            result[field.name] = field.read(binary_file_reader, undefined);
        }

        // TODO: check if all data have been consumed

        return result;
    }

    _readByFields(binary_file_reader, allocated_bytes) {
        const result = {};

        const maxCursor = binary_file_reader.cursor + allocated_bytes;

        while (true) {
            if (binary_file_reader.isFinished() || binary_file_reader.cursor == maxCursor) break;
            
            const blockNumber = binary_file_reader.readBERNumber("Read block #");
            if (blockNumber === 0) break;

            const size = binary_file_reader.readBERNumber("Read size ");

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

    findField(blockNumber) {
        return this.fields.find(field => field.Index === blockNumber);
    }
}

// ==== Field factory



const DispositionHandlers = {
    "List": function (singleElementHandler) {
        return (reader, _) => {
            const quantity = reader.readBERNumber();
    
            let l = [];
            for (let i = 0 ; i != quantity ; ++i) {
                l.push(singleElementHandler(reader, undefined));
            }
    
            return l;
        }
    },
    "Tuple": function(singleElementHandler, quantity) {
        return (reader, _) => {
            let l = [];
            for (let i = 0 ; i != quantity ; ++i) {
                l.push(singleElementHandler(reader, undefined));
            }
    
            return l;
        }
    },
    "Vector": function(singleElementHandler) {
        return (reader, size) => {
            let base = reader.cursor;
    
            let l = [];
            while (reader.cursor < base + size) {
                l.push(singleElementHandler(reader, undefined));
            }
            return l;
        }
    },
    "Array": function(singleElementHandler) {
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
};

const BasicTypeHandlers = {
    "SequentialString": (reader, _) => reader.readString(reader.readBERNumber()),
    "BlockString": (reader, bytes)=> reader.readString(bytes),
    "Int8"  : _readWithUint8Array(1, dataview => dataview.getInt8(0)),
    "Int16" : _readWithUint8Array(2, dataview => dataview.getInt16(0, true)),
    "Int32" : _readWithUint8Array(4, dataview => dataview.getInt32(0, true)),
    "UInt8" : _readWithUint8Array(1, dataview => dataview.getUint8(0)),
    "UInt16": _readWithUint8Array(2, dataview => dataview.getUint16(0, true)),
    "UInt32": _readWithUint8Array(4, dataview => dataview.getUint32(0, true)),
    "Boolean": (reader, _) => {
        let v = reader.readNext();
        if (v === 0) return false;
        if (v === 1) return true;
        throw Error("Handlers::Boolean - Unknown value " + v);
    },
    "Number": (reader, _) => reader.readBERNumber(),
    "SizeField": (reader, _) => reader.readBERNumber()
};

function _readWithUint8Array(size, finalizer) {
    return (reader, _) => {
        let data = new Uint8Array(reader.rawData, reader.cursor, size);
        reader.cursor += size;
        let dataView = new DataView(data.buffer);
        return finalizer(dataView);
    }
}

//

module.exports = Fields;

// For definition only
const BinaryFile = require("./binary_file_reader");
