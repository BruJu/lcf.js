const Fields = require('./src/fields.js');
const BinaryFileReader = require("./src/binary_file_reader.js");

// let fields = new Fields();
// fields._print("Save");

const file = new BinaryFileReader("B:/Save01.lsd");

const size = file.readBERNumber();
const initialType = file.readString(size);

console.error(Fields.getInitialStructure(initialType));
