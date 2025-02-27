import type { Plugin } from "@elizaos/core";
import fetchElection from "./actions/fetchElection";

export const datarennesPlugin: Plugin = {
    name: "datarennes",
    description:
        "Plugin to fetch data from Rennes Metropole's open data platform",
    actions: [fetchElection],
};

export default datarennesPlugin;
