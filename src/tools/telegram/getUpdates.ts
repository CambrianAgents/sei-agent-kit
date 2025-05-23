import * as dotenv from "dotenv";
import { z } from "zod";
import axios from "axios";
import { isValidTelegramToken } from "./utils";
import { TelegramUpdateResponse } from "./schemas";


export async function getUpdates(): Promise<z.infer<typeof TelegramUpdateResponse>> {
    dotenv.config();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    console.log(token);
    if (!token) {
        throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    }

    if (!isValidTelegramToken(token)) {
        throw new Error("Invalid Telegram bot token format.");
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
        const data = await response.json();
        return data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Failed to fetch updates: ${error.response?.data?.description || error.message}`);
        }
        throw error;
    }
}