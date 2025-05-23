import { Tool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";

export class SeiGetTelegramUpdatesTool extends Tool {
    name = "getTelegramUpdates";
    description = "Get updates from Telegram";
    constructor(private agent: SeiAgentKit) {
        super();
    }

    async _call() {
        return this.agent.getTelegramUpdates();
    }
}