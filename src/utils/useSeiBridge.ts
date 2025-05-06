import { toHex } from 'viem';
import { ChainConfig } from './chain';
import { ethers } from 'ethers';
import { SeiAgentKit } from '../index';

export const WASM_PRECOMPILE_ADDRESS =
  '0x0000000000000000000000000000000000001002';

type TransactionParams = {
  agent: SeiAgentKit;
  executeMsg: object;
  fundsMsg: object | null;
  amount?: string;
  onSubmitTx?: (s: string) => unknown;
  chainConfig: ChainConfig;
};
export const WASM_PRECOMPILE_ABI =
  [
    {
      inputs: [
        { internalType: 'string', name: 'contractAddress', type: 'string' },
        { internalType: 'bytes', name: 'msg', type: 'bytes' },
        { internalType: 'bytes', name: 'coins', type: 'bytes' }
      ],
      name: 'execute',
      outputs: [{ internalType: 'bytes', name: 'response', type: 'bytes' }],
      stateMutability: 'payable',
      type: 'function'
    },
    {
      inputs: [
        {
          components: [
            { internalType: 'string', name: 'contractAddress', type: 'string' },
            { internalType: 'bytes', name: 'msg', type: 'bytes' },
            { internalType: 'bytes', name: 'coins', type: 'bytes' }
          ],
          internalType: 'struct IWasmd.ExecuteMsg[]',
          name: 'executeMsgs',
          type: 'tuple[]'
        }
      ],
      name: 'execute_batch',
      outputs: [{ internalType: 'bytes[]', name: 'responses', type: 'bytes[]' }],
      stateMutability: 'payable',
      type: 'function'
    },
    {
      inputs: [
        { internalType: 'uint64', name: 'codeID', type: 'uint64' },
        { internalType: 'string', name: 'admin', type: 'string' },
        { internalType: 'bytes', name: 'msg', type: 'bytes' },
        { internalType: 'string', name: 'label', type: 'string' },
        { internalType: 'bytes', name: 'coins', type: 'bytes' }
      ],
      name: 'instantiate',
      outputs: [
        { internalType: 'string', name: 'contractAddr', type: 'string' },
        { internalType: 'bytes', name: 'data', type: 'bytes' }
      ],
      stateMutability: 'payable',
      type: 'function'
    },
    {
      inputs: [
        { internalType: 'string', name: 'contractAddress', type: 'string' },
        { internalType: 'bytes', name: 'req', type: 'bytes' }
      ],
      name: 'query',
      outputs: [{ internalType: 'bytes', name: 'response', type: 'bytes' }],
      stateMutability: 'view',
      type: 'function'
    }
  ];
export async function seiBridge({
  agent,
  executeMsg,
  fundsMsg,
  chainConfig,
  amount,
  onSubmitTx,
}: TransactionParams) {
  const encodedExecuteMsg = toHex(JSON.stringify(executeMsg));
  const encodedFundsMsg = fundsMsg
    ? toHex(JSON.stringify(fundsMsg))
    : toHex(JSON.stringify([]));

  // Initialize provider using the chain's EVM RPC URL
  const provider = new ethers.providers.JsonRpcProvider({url: chainConfig.evmRpcUrl, skipFetchSetup: true});

  const privateKey = process.env.SEI_PRIVATE_KEY!;
  let signer = new ethers.Wallet(privateKey, provider);


  // Create a contract instance
  const contractInterface = new ethers.utils.Interface(WASM_PRECOMPILE_ABI);
  const contract = new ethers.Contract(
    WASM_PRECOMPILE_ADDRESS,
    contractInterface,
    signer
  );
  // Call the execute function
  const tx = await contract.execute(
    chainConfig.contractAddress,
    encodedExecuteMsg,
    encodedFundsMsg,
    { value: amount ? ethers.utils.parseEther(amount) : undefined }
  );

  const receipt = await tx.wait();
  const hash = receipt.transactionHash;

  if (onSubmitTx) {
    onSubmitTx(hash);
  }

  return hash;
}