const fs = require("fs");
const Fields = require("./fields");

/**
 * A class that parses an RPG Maker 2003 binary file and translates it
 */
class BinaryFile {
    constructor(path) {
        this.rawData = fs.readFileSync(path);
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

        console.error("Read number " + number);

        return number;
    }

    /**
     * Read the following data by considering it is a string.
     * @param {Number} size The number of characters of the string
     * @returns The string
     */
    readString(size) {
        const buffer = Buffer.from(this.rawData.slice(this.cursor, this.cursor + size));
        this.cursor += size;
        return buffer.toString('latin1') // "ISO-8859-15"
    }

    /**
     * Translate the content of the given LCF file to a JS object
     * @param {Fields} fields The `Field` object
     * @param {String} path The path to the file to translate
     */
    static translate(fields, path) {
        const file = new BinaryFile(path);
        const size = file.readBERNumber();
        const initialType = file.readString(size);
        return fields.convert(file, initialType);
    }

    remaining_bytes() {
        return this.rawData.length - this.cursor;
    }

    isFinished() {
        return this.rawData.length <= this.cursor;
    }
}

module.exports = BinaryFile;
