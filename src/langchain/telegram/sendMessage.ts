import { StructuredTool } from "langchain/tools";
import { sendMessage, TelegramSendMessageSchema } from "../../tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
export class SeiSendTelegramMessageTool extends StructuredTool {
    name = "sendTelegramMessage";
    description = "Send a message to a Telegram chat";
    schema = TelegramSendMessageSchema;
    seiKit: SeiAgentKit;

    constructor(seiKit: SeiAgentKit) {
        super();
        this.seiKit = seiKit;
    }

    async _call(input: z.infer<typeof TelegramSendMessageSchema>) {
        return this.seiKit.sendTelegramMessage(input);
    }
}