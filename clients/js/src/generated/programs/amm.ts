/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Address } from '@solana/addresses';
import { Program, ProgramWithErrors } from '@solana/programs';
import {
  AmmProgramError,
  AmmProgramErrorCode,
  getAmmProgramErrorFromCode,
} from '../errors';
import {
  ParsedAttachPoolToMarginInstruction,
  ParsedBuyNftInstruction,
  ParsedBuySingleListingInstruction,
  ParsedBuySingleListingT22Instruction,
  ParsedCloseMarginAccountInstruction,
  ParsedClosePoolInstruction,
  ParsedCreatePoolInstruction,
  ParsedDelistInstruction,
  ParsedDelistT22Instruction,
  ParsedDepositMarginAccountInstruction,
  ParsedDepositNftInstruction,
  ParsedDepositSolInstruction,
  ParsedDetachPoolFromMarginInstruction,
  ParsedEditPoolInstruction,
  ParsedEditSingleListingInstruction,
  ParsedInitSharedEscrowAccountInstruction,
  ParsedListInstruction,
  ParsedListT22Instruction,
  ParsedReallocPoolInstruction,
  ParsedSellNftTokenPoolInstruction,
  ParsedSellNftTradePoolInstruction,
  ParsedWithdrawMarginAccountInstruction,
  ParsedWithdrawNftInstruction,
  ParsedWithdrawSolInstruction,
} from '../instructions';
import { memcmp } from '../shared';

export const AMM_PROGRAM_ADDRESS =
  'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;

export type AmmProgram =
  Program<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'> &
    ProgramWithErrors<AmmProgramErrorCode, AmmProgramError>;

export function getAmmProgram(): AmmProgram {
  return {
    name: 'amm',
    address: AMM_PROGRAM_ADDRESS,
    getErrorFromCode(code: AmmProgramErrorCode, cause?: Error) {
      return getAmmProgramErrorFromCode(code, cause);
    },
  };
}

export enum AmmAccount {
  NftDepositReceipt,
  Pool,
  SharedEscrow,
  SingleListing,
  SolEscrow,
  EscrowOwner,
  EscrowTokenAccount,
  FeeVault,
}

export function identifyAmmAccount(
  account: { data: Uint8Array } | Uint8Array
): AmmAccount {
  const data = account instanceof Uint8Array ? account : account.data;
  if (memcmp(data, new Uint8Array([206, 255, 132, 254, 67, 78, 62, 96]), 0)) {
    return AmmAccount.NftDepositReceipt;
  }
  if (memcmp(data, new Uint8Array([241, 154, 109, 4, 17, 177, 109, 188]), 0)) {
    return AmmAccount.Pool;
  }
  if (memcmp(data, new Uint8Array([224, 55, 20, 31, 220, 116, 183, 194]), 0)) {
    return AmmAccount.SharedEscrow;
  }
  if (memcmp(data, new Uint8Array([14, 114, 212, 140, 24, 134, 31, 24]), 0)) {
    return AmmAccount.SingleListing;
  }
  if (memcmp(data, new Uint8Array([75, 199, 250, 63, 244, 209, 235, 120]), 0)) {
    return AmmAccount.SolEscrow;
  }
  if (memcmp(data, new Uint8Array([215, 217, 229, 238, 9, 70, 144, 119]), 0)) {
    return AmmAccount.EscrowOwner;
  }
  if (memcmp(data, new Uint8Array([187, 204, 104, 138, 3, 193, 34, 208]), 0)) {
    return AmmAccount.EscrowTokenAccount;
  }
  if (memcmp(data, new Uint8Array([192, 178, 69, 232, 58, 149, 157, 132]), 0)) {
    return AmmAccount.FeeVault;
  }
  throw new Error(
    'The provided account could not be identified as a amm account.'
  );
}

export enum AmmInstruction {
  ReallocPool,
  CreatePool,
  EditPool,
  ClosePool,
  DepositNft,
  WithdrawNft,
  DepositSol,
  WithdrawSol,
  BuyNft,
  SellNftTokenPool,
  SellNftTradePool,
  InitSharedEscrowAccount,
  CloseMarginAccount,
  DepositMarginAccount,
  WithdrawMarginAccount,
  AttachPoolToMargin,
  DetachPoolFromMargin,
  List,
  Delist,
  BuySingleListing,
  EditSingleListing,
  BuySingleListingT22,
  ListT22,
  DelistT22,
}

export function identifyAmmInstruction(
  instruction: { data: Uint8Array } | Uint8Array
): AmmInstruction {
  const data =
    instruction instanceof Uint8Array ? instruction : instruction.data;
  if (memcmp(data, new Uint8Array([114, 128, 37, 167, 71, 227, 40, 178]), 0)) {
    return AmmInstruction.ReallocPool;
  }
  if (
    memcmp(data, new Uint8Array([233, 146, 209, 142, 207, 104, 64, 188]), 0)
  ) {
    return AmmInstruction.CreatePool;
  }
  if (memcmp(data, new Uint8Array([50, 174, 34, 36, 3, 166, 29, 204]), 0)) {
    return AmmInstruction.EditPool;
  }
  if (memcmp(data, new Uint8Array([140, 189, 209, 23, 239, 62, 239, 11]), 0)) {
    return AmmInstruction.ClosePool;
  }
  if (memcmp(data, new Uint8Array([93, 226, 132, 166, 141, 9, 48, 101]), 0)) {
    return AmmInstruction.DepositNft;
  }
  if (
    memcmp(data, new Uint8Array([142, 181, 191, 149, 82, 175, 216, 100]), 0)
  ) {
    return AmmInstruction.WithdrawNft;
  }
  if (memcmp(data, new Uint8Array([108, 81, 78, 117, 125, 155, 56, 200]), 0)) {
    return AmmInstruction.DepositSol;
  }
  if (memcmp(data, new Uint8Array([145, 131, 74, 136, 65, 137, 42, 38]), 0)) {
    return AmmInstruction.WithdrawSol;
  }
  if (memcmp(data, new Uint8Array([96, 0, 28, 190, 49, 107, 83, 222]), 0)) {
    return AmmInstruction.BuyNft;
  }
  if (memcmp(data, new Uint8Array([57, 44, 192, 48, 83, 8, 107, 48]), 0)) {
    return AmmInstruction.SellNftTokenPool;
  }
  if (memcmp(data, new Uint8Array([131, 82, 125, 77, 13, 157, 36, 90]), 0)) {
    return AmmInstruction.SellNftTradePool;
  }
  if (
    memcmp(data, new Uint8Array([250, 243, 149, 156, 231, 41, 150, 104]), 0)
  ) {
    return AmmInstruction.InitSharedEscrowAccount;
  }
  if (memcmp(data, new Uint8Array([105, 215, 41, 239, 166, 207, 1, 103]), 0)) {
    return AmmInstruction.CloseMarginAccount;
  }
  if (memcmp(data, new Uint8Array([190, 85, 242, 60, 119, 81, 33, 192]), 0)) {
    return AmmInstruction.DepositMarginAccount;
  }
  if (memcmp(data, new Uint8Array([54, 73, 150, 208, 207, 5, 18, 17]), 0)) {
    return AmmInstruction.WithdrawMarginAccount;
  }
  if (memcmp(data, new Uint8Array([187, 105, 211, 137, 224, 59, 29, 227]), 0)) {
    return AmmInstruction.AttachPoolToMargin;
  }
  if (memcmp(data, new Uint8Array([182, 54, 73, 38, 188, 87, 185, 101]), 0)) {
    return AmmInstruction.DetachPoolFromMargin;
  }
  if (memcmp(data, new Uint8Array([54, 174, 193, 67, 17, 41, 132, 38]), 0)) {
    return AmmInstruction.List;
  }
  if (memcmp(data, new Uint8Array([55, 136, 205, 107, 107, 173, 4, 31]), 0)) {
    return AmmInstruction.Delist;
  }
  if (memcmp(data, new Uint8Array([245, 220, 105, 73, 117, 98, 78, 141]), 0)) {
    return AmmInstruction.BuySingleListing;
  }
  if (memcmp(data, new Uint8Array([88, 38, 236, 212, 31, 185, 18, 166]), 0)) {
    return AmmInstruction.EditSingleListing;
  }
  if (memcmp(data, new Uint8Array([102, 89, 66, 0, 5, 68, 84, 216]), 0)) {
    return AmmInstruction.BuySingleListingT22;
  }
  if (memcmp(data, new Uint8Array([9, 117, 93, 230, 221, 4, 199, 212]), 0)) {
    return AmmInstruction.ListT22;
  }
  if (memcmp(data, new Uint8Array([216, 72, 73, 18, 204, 82, 123, 26]), 0)) {
    return AmmInstruction.DelistT22;
  }
  throw new Error(
    'The provided instruction could not be identified as a amm instruction.'
  );
}

export type ParsedAmmInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
> =
  | ({
      instructionType: AmmInstruction.ReallocPool;
    } & ParsedReallocPoolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.CreatePool;
    } & ParsedCreatePoolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.EditPool;
    } & ParsedEditPoolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.ClosePool;
    } & ParsedClosePoolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.DepositNft;
    } & ParsedDepositNftInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.WithdrawNft;
    } & ParsedWithdrawNftInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.DepositSol;
    } & ParsedDepositSolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.WithdrawSol;
    } & ParsedWithdrawSolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.BuyNft;
    } & ParsedBuyNftInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.SellNftTokenPool;
    } & ParsedSellNftTokenPoolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.SellNftTradePool;
    } & ParsedSellNftTradePoolInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.InitSharedEscrowAccount;
    } & ParsedInitSharedEscrowAccountInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.CloseMarginAccount;
    } & ParsedCloseMarginAccountInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.DepositMarginAccount;
    } & ParsedDepositMarginAccountInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.WithdrawMarginAccount;
    } & ParsedWithdrawMarginAccountInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.AttachPoolToMargin;
    } & ParsedAttachPoolToMarginInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.DetachPoolFromMargin;
    } & ParsedDetachPoolFromMarginInstruction<TProgram>)
  | ({ instructionType: AmmInstruction.List } & ParsedListInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.Delist;
    } & ParsedDelistInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.BuySingleListing;
    } & ParsedBuySingleListingInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.EditSingleListing;
    } & ParsedEditSingleListingInstruction<TProgram>)
  | ({
      instructionType: AmmInstruction.BuySingleListingT22;
    } & ParsedBuySingleListingT22Instruction<TProgram>)
  | ({
      instructionType: AmmInstruction.ListT22;
    } & ParsedListT22Instruction<TProgram>)
  | ({
      instructionType: AmmInstruction.DelistT22;
    } & ParsedDelistT22Instruction<TProgram>);
