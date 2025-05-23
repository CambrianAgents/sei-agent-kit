import { Context } from 'telegraf';

export interface TelegramConfig {
    token: string;
    defaultChatId?: string | number;
}

export interface TelegramMessage {
    chatId: string | number;
    text: string;
}

export interface TelegramPhotoMessage extends Omit<TelegramMessage, 'text'> {
    photo: string;
    caption?: string;
}

export interface TelegramCommandHandler {
    command: string;
    handler: (ctx: Context) => Promise<void>;
}

export interface TelegramError extends Error {
    code?: number;
    response?: any;
} 