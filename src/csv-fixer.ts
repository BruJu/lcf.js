
export function adaptType(type: string, isSizeField: string): [string, string] {
  if (isSizeField === 't') {
     return ["", "SizeField"];
  }

  let disposition = "";

  let vec = maybeExtract(type, "Vector");
  if (vec !== null) {
    disposition = vec[0]; type = vec[1];
  }
    
  vec = maybeExtract(type, "Array");
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

  if (type === "Int32") {
    type = "Number";
  }

  if (type === 'EmptyBlock') type = "";

  return [disposition, type];
}

export function maybeExtract(type: string, str: string): [string, string] | null {
  if (type.startsWith(str)) {
    let t = type.substring(str.length + 1);
    return [str, t.substring(0, t.length - 1)]
  } else {
    return null;
  }
}

export function pickRM2k3Default(str: string): string {
  let split = str.split("|");
  return split[split.length - 1];
}
