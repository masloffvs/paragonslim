import type { Ch } from "../../ch/init";
import type { VolumesConfig } from "../../servers/config";

export class Context {
    public readonly variables: Map<string, any> = new Map();
    public readonly datasetSchemas: Map<string, { primaryKey?: string[] }> = new Map();
    
    constructor(
        public readonly ch: Ch,
        public readonly volumesConfig: VolumesConfig
    ) {
        
    }
}
