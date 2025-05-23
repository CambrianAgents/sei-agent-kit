import * as dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { z } from "zod";
import { TelegramCommandSchema } from "./schemas";
import { isValidTelegramToken } from "./utils";

export async function handleCommand(args: z.infer<typeof TelegramCommandSchema>) {
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
        bot.command(args.command, async (ctx) => {
            await ctx.reply(args.response);
        });
        await bot.launch();

        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

        return `Successfully registered command /${args.command}`;
    } catch (error) {
        return `Error registering command: ${error}`;
    }
} 