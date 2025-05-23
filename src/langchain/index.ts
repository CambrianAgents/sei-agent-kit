export * from './sei-erc20';
export * from './sei-erc721';
export * from './symphony';
export * from './dexscreener';
export * from './silo';
export * from './takara';
export * from './twitter';
export * from './telegram';

import type { SeiAgentKit } from "../agent";
import {
  SeiERC20BalanceTool,
  SeiERC20TransferTool,
  SeiERC721BalanceTool,
  SeiERC721TransferTool,
  SeiERC721MintTool,
  SeiGetTokenAddressTool,
  SeiStakeTool,
  SeiUnstakeTool,
  SeiSwapTool,
  SeiMintTakaraTool,
  SeiBorrowTakaraTool,
  SeiRepayTakaraTool,
  SeiRedeemTakaraTool,
  SeiGetRedeemableAmountTool,
  SeiGetBorrowBalanceTool,
  SeiPostTweetTool,
  SeiGetAccountDetailsTool,
  SeiGetAccountMentionsTool,
  SeiPostTweetReplyTool,
  SeiGetTelegramUpdatesTool,
  SeiSendTelegramMessageTool,
} from './index';


export function createSeiTools(seiKit: SeiAgentKit) {
  return [
    new SeiERC20BalanceTool(seiKit),
    new SeiERC20TransferTool(seiKit),
    new SeiERC721BalanceTool(seiKit),
    new SeiERC721TransferTool(seiKit),
    new SeiERC721MintTool(seiKit),
    new SeiGetTokenAddressTool(seiKit),
    new SeiStakeTool(seiKit),
    new SeiUnstakeTool(seiKit),
    new SeiSwapTool(seiKit),
    new SeiMintTakaraTool(seiKit),
    new SeiBorrowTakaraTool(seiKit),
    new SeiRepayTakaraTool(seiKit),
    new SeiRedeemTakaraTool(seiKit),
    new SeiGetRedeemableAmountTool(seiKit),
    new SeiGetBorrowBalanceTool(seiKit),
    new SeiPostTweetTool(seiKit),
    new SeiGetAccountDetailsTool(seiKit),
    new SeiGetAccountMentionsTool(seiKit),
    new SeiPostTweetReplyTool(seiKit),
    new SeiGetTelegramUpdatesTool(seiKit),
    new SeiSendTelegramMessageTool(seiKit),
  ];
}
     