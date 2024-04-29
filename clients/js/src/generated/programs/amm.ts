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
  ParsedBuyNftInstruction,
  ParsedBuyNftT22Instruction,
  ParsedCloseExpiredPoolInstruction,
  ParsedClosePoolInstruction,
  ParsedCreatePoolInstruction,
  ParsedDepositNftInstruction,
  ParsedDepositNftT22Instruction,
  ParsedDepositSolInstruction,
  ParsedEditPoolInstruction,
  ParsedReallocPoolInstruction,
  ParsedSellNftTokenPoolInstruction,
  ParsedSellNftTokenPoolT22Instruction,
  ParsedSellNftTradePoolInstruction,
  ParsedSellNftTradePoolT22Instruction,
  ParsedTammNoopInstruction,
  ParsedWithdrawNftInstruction,
  ParsedWithdrawNftT22Instruction,
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
  SingleListing,
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
  if (memcmp(data, new Uint8Array([14, 114, 212, 140, 24, 134, 31, 24]), 0)) {
    return AmmAccount.SingleListing;
  }
  if (memcmp(data, new Uint8Array([192, 178, 69, 232, 58, 149, 157, 132]), 0)) {
    return AmmAccount.FeeVault;
  }
  throw new Error(
    'The provided account could not be identified as a amm account.'
  );
}

export enum AmmInstruction {
  TammNoop,
  ReallocPool,
  CreatePool,
  EditPool,
  ClosePool,
  CloseExpiredPool,
  DepositNft,
  WithdrawNft,
  DepositSol,
  WithdrawSol,
  BuyNft,
  SellNftTokenPool,
  SellNftTradePool,
  BuyNftT22,
  DepositNftT22,
  SellNftTokenPoolT22,
  SellNftTradePoolT22,
  WithdrawNftT22,
}

export function identifyAmmInstruction(
  instruction: { data: Uint8Array } | Uint8Array
): AmmInstruction {
  const data =
    instruction instanceof Uint8Array ? instruction : instruction.data;
  if (
    memcmp(data, new Uint8Array([31, 162, 228, 158, 153, 160, 198, 182]), 0)
  ) {
    return AmmInstruction.TammNoop;
  }
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
  if (memcmp(data, new Uint8Array([108, 212, 233, 53, 132, 83, 63, 219]), 0)) {
    return AmmInstruction.CloseExpiredPool;
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
  if (memcmp(data, new Uint8Array([155, 219, 126, 245, 170, 199, 51, 79]), 0)) {
    return AmmInstruction.BuyNftT22;
  }
  if (memcmp(data, new Uint8Array([208, 34, 6, 147, 95, 218, 49, 160]), 0)) {
    return AmmInstruction.DepositNftT22;
  }
  if (memcmp(data, new Uint8Array([149, 234, 31, 103, 26, 36, 166, 49]), 0)) {
    return AmmInstruction.SellNftTokenPoolT22;
  }
  if (memcmp(data, new Uint8Array([124, 145, 23, 52, 72, 113, 85, 9]), 0)) {
    return AmmInstruction.SellNftTradePoolT22;
  }
  if (memcmp(data, new Uint8Array([112, 55, 80, 231, 181, 190, 92, 12]), 0)) {
    return AmmInstruction.WithdrawNftT22;
  }
  throw new Error(
    'The provided instruction could not be identified as a amm instruction.'
  );
}

export type ParsedAmmInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
> =
  | ({
      instructionType: AmmInstruction.TammNoop;
    } & ParsedTammNoopInstruction<TProgram>)
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
      instructionType: AmmInstruction.CloseExpiredPool;
    } & ParsedCloseExpiredPoolInstruction<TProgram>)
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
      instructionType: AmmInstruction.BuyNftT22;
    } & ParsedBuyNftT22Instruction<TProgram>)
  | ({
      instructionType: AmmInstruction.DepositNftT22;
    } & ParsedDepositNftT22Instruction<TProgram>)
  | ({
      instructionType: AmmInstruction.SellNftTokenPoolT22;
    } & ParsedSellNftTokenPoolT22Instruction<TProgram>)
  | ({
      instructionType: AmmInstruction.SellNftTradePoolT22;
    } & ParsedSellNftTradePoolT22Instruction<TProgram>)
  | ({
      instructionType: AmmInstruction.WithdrawNftT22;
    } & ParsedWithdrawNftT22Instruction<TProgram>);
