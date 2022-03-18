
export default function toLCFSave(rawData: {[key: string]: any}) {
  rawData.getLeaderName = (): string => {
    return rawData.title.hero_name;
  };
    
  rawData.getVariableState = (variableId: number): number | undefined => {
    return rawData.system.variables[variableId - 1];
  };
    
  rawData.getSwitchState = (switchId: number): boolean | undefined => {
    return rawData.system.switches[switchId - 1];
  }
  
  return rawData;
}

/*
export class ProxiedLCFSave {
  private readonly _raw: {[key: string]: any} = {};

  constructor(rawData: {[key: string]: any}) {
    for (const [fieldName, fieldValue] of Object.entries(rawData)) {
      this._raw[fieldName] = fieldValue;
    }
  }

  getLeaderName(): string {
    return this._raw.title.hero_name;
  }

  getVariableState(variableId: number): number | undefined {
    return this._raw.system.variables[variableId - 1];
  }

  getSwitchState(switchId: number): boolean | undefined {
    return this._raw.system.switches[switchId - 1];
  }
};

*/
