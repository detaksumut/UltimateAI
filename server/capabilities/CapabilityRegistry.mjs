import { WebSearch } from "./external/WebSearch.mjs";
import { WebOpen } from "./external/WebOpen.mjs";
import { SystemCapabilities } from "./internal/SystemCapabilities.mjs";

class CapabilityRegistry {
    constructor() {
        this.capabilities = new Map();

        this.register(WebSearch);
        this.register(WebOpen);

        for (const capability of SystemCapabilities) {
            this.register(capability);
        }
    }

    register(capability) {
        if (!capability?.name) {
            throw new Error("Capability requires a name");
        }

        if (this.capabilities.has(capability.name)) {
            throw new Error(
                `Duplicate capability: ${capability.name}`
            );
        }

        this.capabilities.set(
            capability.name,
            capability
        );
    }

    get(name) {
        return this.capabilities.get(name);
    }

    list() {
        return [...this.capabilities.values()].map(
            capability => ({
                name: capability.name,
                description: capability.description
            })
        );
    }

    async execute(name, params = {}) {
        const capability = this.get(name);

        if (!capability) {
            throw new Error(
                `Capability not found: ${name}`
            );
        }

        if (typeof capability.execute !== "function") {
            throw new Error(
                `Capability is not executable: ${name}`
            );
        }

        return capability.execute(params);
    }
}

export const capabilityRegistry =
    new CapabilityRegistry();

export {
    CapabilityRegistry
};

export default capabilityRegistry;
