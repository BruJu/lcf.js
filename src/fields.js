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

        for (let structure of csv.data) {
            if (this.structures[structure.Structure] === undefined) {
                this.structures[structure.Structure] = [];
            }

            this.structures[structure.Structure].push(structure);
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
}

module.exports = Fields;
