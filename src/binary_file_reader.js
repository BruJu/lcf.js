const fs = require("fs");

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
}

module.exports = BinaryFile;
