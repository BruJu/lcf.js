
class LCFSave {
    constructor(rawData) {
        for (const [fieldName, fieldValue] of Object.entries(rawData)) {
            this[fieldName] = fieldValue;
        }
    }

    getLeaderName() {
        return this.title.hero_name;
    }

    getVariableState(variableId) {
        return this.system.variables[variableId - 1];
    }

    getSwitchState(switchId) {
        return this.system.switches[switchId - 1];
    }
};


module.exports = LCFSave;