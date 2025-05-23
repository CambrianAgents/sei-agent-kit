import * as dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { z } from "zod";
import { TelegramSendMessageSchema } from "../src/tools/telegram/schemas";
import { isValidTelegramToken } from "../src/tools/telegram/utils";

export async function sendMessage(args: z.infer<typeof TelegramSendMessageSchema>) {
    dotenv.config();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    }

    if (!isValidTelegramToken(token)) {
        throw new Error("Invalid Telegram bot token format.");
    }

    try {
        const bot = new Telegraf(token);
        await bot.telegram.sendMessage(args.chatId, args.text);
        return `Successfully sent message to chat ${args.chatId}`;
    } catch (error) {
        return `Error sending message: ${error}`;
    }
} 

sendMessage({
    chatId: 6499164350,
    text: "Hello, world!",
});