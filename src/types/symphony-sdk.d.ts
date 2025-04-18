declare module 'symphony-sdk/viem' {
    import { WalletClient } from 'viem';

    export class Symphony {
        constructor(options?: { walletClient?: WalletClient });
        connectWalletClient(walletClient: WalletClient): void;
        getRoute(tokenIn: `0x${string}`, tokenOut: `0x${string}`, amount: string): Promise<Route>;
    }

    export class Route {
        checkApproval(): Promise<boolean>;
        giveApproval(): Promise<any>;
        swap(): Promise<{ swapReceipt: { transactionHash: string } }>;
    }
} 