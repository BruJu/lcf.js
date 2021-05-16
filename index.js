const Fields = require('./src/fields.js');
const BinaryFileReader = require("./src/binary_file_reader.js");
const util = require('util');

let fields = new Fields();

// fields._print("Save");

//const file = new BinaryFileReader("B:/Save01.lsd");
//const file = new BinaryFileReader("B:/RPG_RT.lmt");
//
//const size = file.readBERNumber();
//const initialType = file.readString(size);
//
//console.error(Fields.getInitialStructure(initialType));

if (require.main === module) {
    let save = BinaryFileReader.translate(fields, "b:/Save07.lsd");

    console.error(save.getLeaderName());
    console.error(save.getVariableState(4942));
    console.error(save.getSwitchState(2620));
    console.error(save.getSwitchState(2656));

    //console.error(
    //    util.inspect(
    //        BinaryFileReader.translate(fields, "b:/Save01.lsd"),
    //        {
    //            depth: null,
    //            colors: true
    //        }
    //    )
    //);
/*
    console.error(
        util.inspect(
            BinaryFileReader.translate(fields, "b:/RPG_RT.lmt"),
            {
                depth: null,
                colors: true
            }
        )
    );
*/
    
//console.error(fields.getListOfUnhandledTypes());

}


module.exports = function(path) {
    return BinaryFileReader.translate(fields, path);
}