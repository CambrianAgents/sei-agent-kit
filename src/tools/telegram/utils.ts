import { Context } from 'telegraf';
import { TelegramError } from './types';

/**
 * Extract chat ID from a Telegram context
 */
export function getChatId(ctx: Context): number | undefined {
    if (ctx.message && 'chat' in ctx.message) {
        return ctx.message.chat.id;
    }
    return undefined;
}

/**
 * Create a formatted error from Telegram API errors
 */
export function createTelegramError(error: any): TelegramError {
    const telegramError: TelegramError = new Error(
        error.description || error.message || 'Unknown Telegram error'
    );

    if (error.code) {
        telegramError.code = error.code;
    }

    if (error.response) {
        telegramError.response = error.response;
    }

    return telegramError;
}

/**
 * Validate Telegram bot token format
 */
export function isValidTelegramToken(token: string): boolean {
    const tokenRegex = /^\d+:[A-Za-z0-9_-]{35}$/;
    return tokenRegex.test(token);
}

/**
 * Format message text with Markdown
 */
export function formatMarkdownV2(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Extract username from context
 */
export function getUsername(ctx: Context): string | undefined {
    if (ctx.message && 'from' in ctx.message) {
        return ctx.message.from.username;
    }
    return undefined;
}

/**
 * Check if a message is a command
 */
export function isCommand(text: string): boolean {
    return text.startsWith('/');
}

/**
 * Extract command from message text
 */
export function extractCommand(text: string): string | null {
    if (!isCommand(text)) return null;
    const match = text.match(/^\/([^\s@]+)/);
    return match ? match[1] : null;
} 