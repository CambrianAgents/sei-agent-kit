import { z } from "zod";

/**
 * Input schema for sending a message.
 */
export const TelegramSendMessageSchema = z
    .object({
        chatId: z.union([z.string(), z.number()]).describe("The chat ID to send the message to"),
        text: z.string().describe("The text message to send"),
    })
    .strip()
    .describe("Input schema for sending a Telegram message");

/**
 * Input schema for sending a photo.
 */
export const TelegramSendPhotoSchema = z
    .object({
        chatId: z.union([z.string(), z.number()]).describe("The chat ID to send the photo to"),
        photo: z.string().describe("The photo URL or file path to send"),
        caption: z.string().optional().describe("Optional caption for the photo"),
    })
    .strip()
    .describe("Input schema for sending a Telegram photo");

/**
 * Input schema for handling commands.
 */
export const TelegramCommandSchema = z
    .object({
        command: z.string().describe("The command to handle (without the / prefix)"),
        response: z.string().describe("The response text to send when command is received"),
    })
    .strip()
    .describe("Input schema for handling Telegram commands"); 

export const TelegramUpdateResponse = z.object({
    ok: z.boolean(),
    result: z.array(z.object({
        update_id: z.number(),
            message: z.object({
                message_id: z.number(),
                from: z.object({
                    id: z.number(),
                    is_bot: z.boolean(),
                    first_name: z.string(),
                    username: z.string().optional(),
                    language_code: z.string().optional()
                }),
                chat: z.object({
                    id: z.number(),
                    first_name: z.string(),
                    username: z.string().optional(),
                    type: z.string()
                }),
                date: z.number(),
                text: z.string().optional()
            }).optional()
        }))
    });