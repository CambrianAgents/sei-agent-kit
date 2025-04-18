import { WalletClient } from "viem";

// Define a type for the Symphony and Route classes based on what we need
interface ISymphonyRoute {
    checkApproval(): Promise<boolean>;
    giveApproval(): Promise<any>;
    swap(): Promise<{ swapReceipt: { transactionHash: string } }>;
}

interface ISymphony {
    connectWalletClient(walletClient: WalletClient): void;
    getRoute(tokenIn: `0x${string}`, tokenOut: `0x${string}`, amount: string): Promise<ISymphonyRoute>;
}

// This function creates a Symphony instance with proper dynamic imports
export async function createSymphony(options?: { walletClient?: WalletClient }): Promise<ISymphony> {
    try {
        // Using dynamic import to handle ESM modules
        // We need to use a more specific approach for CommonJS compatibility
        let Symphony;

        try {
            // Try direct dynamic import first
            const symphonyImport = await import('symphony-sdk/viem');
            Symphony = symphonyImport.Symphony;
        } catch (importError) {
            // If that fails, use a different approach
            console.error('Failed to import Symphony with dynamic import, trying alternative:', importError);

            // Load as a module using Function constructor to evaluate the import
            // This is a workaround for CommonJS environments
            const importFunc = new Function('modulePath', 'return import(modulePath)');
            const symphonyImport = await importFunc('symphony-sdk/viem');
            Symphony = symphonyImport.Symphony;
        }

        return new Symphony(options) as ISymphony;
    } catch (error) {
        console.error('Error importing Symphony:', error);
        throw new Error('Failed to load Symphony SDK: ' + (error instanceof Error ? error.message : String(error)));
    }
} 