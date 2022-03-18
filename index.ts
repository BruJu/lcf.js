import Fields, { translate } from "./src/fields";

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
    let save = translate(fields, "b:/Save07.lsd");

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

export default function readFile(path: string) {
  return translate(fields, path);
}
