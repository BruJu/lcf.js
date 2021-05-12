const Papa = require("papaparse");
const fs = require("fs");

/**
 * Reader for the `fields.csv` resource file
 */
class Fields {
    constructor(path = "resource/fields.csv") {
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

    getHandlerFor(structure) {
        const definition = this.structures[structure];
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

    _readSerial(binary_file_reader, allocated_bytes) {
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

        while (true) {
            if (binary_file_reader.isFinished()) break;
            
            const blockNumber = binary_file_reader.readBERNumber();
            if (blockNumber === 0) break;

            const size = binary_file_reader.readBERNumber();

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
        return result;
    }

    findField(blockNumber) {
        for (const field of this.fields) {
            console.error(field.Index);
            break;
        }
        return this.fields.find(field => field.Index === blockNumber);
    }

    addField(field) {
        const expectedRead = field.Index === "" ? this._readSerial : this._readByFields;

        if (expectedRead !== this.read) {
            throw Error(`Structure ${this.name} have two incoherent fields Index wise`);
        }

        this.fields.push({
            name: field.Field,
            Index: parseInt(field.Index, 16),
            read: makeHandler(this.FIELDS, F.readType(field.Type))
        });
    }
}

// ==== Field factory

const F = {
    /**
     * 
     * @param {String} type 
     */
    readType(type) {
        const regex = /^([a-zA-z0-9]*)<(.*)>$/m;
        const m = type.match(regex);

        if (m === null) return [type];
        return [m[1], this.readType(m[2])];
    }

}

function makeHandler(FIELDS, type_) {
    if (type_[0] === 'Array') {
        const handler = new HandlerArray(FIELDS, type_.slice(1));
        return (a, b) => handler.read(a, b);
    } else if (type_[0] === "Ref") {
        return Handler.Int32;
    } else if (type_[0] === "Enum") {
        return Handler.Int32;
    } else if (type_[0] === "DBString") {
        return Handler.String;
    }

    const handler = FIELDS.getHandlerFor(type_[0]);
    if (handler) return handler;

    return Handler.Unknown;
}

// ==== Field implementations

const Handler = {
    Unknown: (_binary_file_reader, _size) => {},
    Int32: (binary_file_reader, _size) => binary_file_reader.readBERNumber(),
    "String": function(binary_file_reader, size) {
        if (size === undefined) {
            size = binary_file_reader.readBERNumber();
        }

        return binary_file_reader.readString(size);
    }

};




class HandlerArray {
    constructor(FIELDS, remainingTypes) {
        this.subhandler = makeHandler(FIELDS, remainingTypes);
    }

    /**
     * 
     * @param {BinaryFile} binary_file_reader 
     */
    read(binary_file_reader, _size) {
        const number_of_elements = binary_file_reader.readBERNumber();
        let map = {};

        for (let i = 0 ; i != number_of_elements ; ++i) {
            const id = binary_file_reader.readBERNumber();
            const data = this.subhandler(binary_file_reader);
            map[id] = data;
        }

        return map;
    }
}

//

module.exports = Fields;

// For definition only
const BinaryFile = require("./binary_file_reader");
