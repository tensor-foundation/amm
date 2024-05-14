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
  TensorAmmProgramError,
  TensorAmmProgramErrorCode,
  getTensorAmmProgramErrorFromCode,
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

export const TENSOR_AMM_PROGRAM_ADDRESS =
  'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA' as Address<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'>;

export type TensorAmmProgram =
  Program<'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA'> &
    ProgramWithErrors<TensorAmmProgramErrorCode, TensorAmmProgramError>;

export function getTensorAmmProgram(): TensorAmmProgram {
  return {
    name: 'tensorAmm',
    address: TENSOR_AMM_PROGRAM_ADDRESS,
    getErrorFromCode(code: TensorAmmProgramErrorCode, cause?: Error) {
      return getTensorAmmProgramErrorFromCode(code, cause);
    },
  };
}

export enum TensorAmmAccount {
  NftDepositReceipt,
  Pool,
}

export function identifyTensorAmmAccount(
  account: { data: Uint8Array } | Uint8Array
): TensorAmmAccount {
  const data = account instanceof Uint8Array ? account : account.data;
  if (memcmp(data, new Uint8Array([206, 255, 132, 254, 67, 78, 62, 96]), 0)) {
    return TensorAmmAccount.NftDepositReceipt;
  }
  if (memcmp(data, new Uint8Array([241, 154, 109, 4, 17, 177, 109, 188]), 0)) {
    return TensorAmmAccount.Pool;
  }
  throw new Error(
    'The provided account could not be identified as a tensorAmm account.'
  );
}

export enum TensorAmmInstruction {
  TammNoop,
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

export function identifyTensorAmmInstruction(
  instruction: { data: Uint8Array } | Uint8Array
): TensorAmmInstruction {
  const data =
    instruction instanceof Uint8Array ? instruction : instruction.data;
  if (
    memcmp(data, new Uint8Array([31, 162, 228, 158, 153, 160, 198, 182]), 0)
  ) {
    return TensorAmmInstruction.TammNoop;
  }
  if (
    memcmp(data, new Uint8Array([233, 146, 209, 142, 207, 104, 64, 188]), 0)
  ) {
    return TensorAmmInstruction.CreatePool;
  }
  if (memcmp(data, new Uint8Array([50, 174, 34, 36, 3, 166, 29, 204]), 0)) {
    return TensorAmmInstruction.EditPool;
  }
  if (memcmp(data, new Uint8Array([140, 189, 209, 23, 239, 62, 239, 11]), 0)) {
    return TensorAmmInstruction.ClosePool;
  }
  if (memcmp(data, new Uint8Array([108, 212, 233, 53, 132, 83, 63, 219]), 0)) {
    return TensorAmmInstruction.CloseExpiredPool;
  }
  if (memcmp(data, new Uint8Array([93, 226, 132, 166, 141, 9, 48, 101]), 0)) {
    return TensorAmmInstruction.DepositNft;
  }
  if (
    memcmp(data, new Uint8Array([142, 181, 191, 149, 82, 175, 216, 100]), 0)
  ) {
    return TensorAmmInstruction.WithdrawNft;
  }
  if (memcmp(data, new Uint8Array([108, 81, 78, 117, 125, 155, 56, 200]), 0)) {
    return TensorAmmInstruction.DepositSol;
  }
  if (memcmp(data, new Uint8Array([145, 131, 74, 136, 65, 137, 42, 38]), 0)) {
    return TensorAmmInstruction.WithdrawSol;
  }
  if (memcmp(data, new Uint8Array([96, 0, 28, 190, 49, 107, 83, 222]), 0)) {
    return TensorAmmInstruction.BuyNft;
  }
  if (memcmp(data, new Uint8Array([57, 44, 192, 48, 83, 8, 107, 48]), 0)) {
    return TensorAmmInstruction.SellNftTokenPool;
  }
  if (memcmp(data, new Uint8Array([131, 82, 125, 77, 13, 157, 36, 90]), 0)) {
    return TensorAmmInstruction.SellNftTradePool;
  }
  if (memcmp(data, new Uint8Array([155, 219, 126, 245, 170, 199, 51, 79]), 0)) {
    return TensorAmmInstruction.BuyNftT22;
  }
  if (memcmp(data, new Uint8Array([208, 34, 6, 147, 95, 218, 49, 160]), 0)) {
    return TensorAmmInstruction.DepositNftT22;
  }
  if (memcmp(data, new Uint8Array([149, 234, 31, 103, 26, 36, 166, 49]), 0)) {
    return TensorAmmInstruction.SellNftTokenPoolT22;
  }
  if (memcmp(data, new Uint8Array([124, 145, 23, 52, 72, 113, 85, 9]), 0)) {
    return TensorAmmInstruction.SellNftTradePoolT22;
  }
  if (memcmp(data, new Uint8Array([112, 55, 80, 231, 181, 190, 92, 12]), 0)) {
    return TensorAmmInstruction.WithdrawNftT22;
  }
  throw new Error(
    'The provided instruction could not be identified as a tensorAmm instruction.'
  );
}

export type ParsedTensorAmmInstruction<
  TProgram extends string = 'TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA',
> =
  | ({
      instructionType: TensorAmmInstruction.TammNoop;
    } & ParsedTammNoopInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.CreatePool;
    } & ParsedCreatePoolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.EditPool;
    } & ParsedEditPoolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.ClosePool;
    } & ParsedClosePoolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.CloseExpiredPool;
    } & ParsedCloseExpiredPoolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.DepositNft;
    } & ParsedDepositNftInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawNft;
    } & ParsedWithdrawNftInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.DepositSol;
    } & ParsedDepositSolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawSol;
    } & ParsedWithdrawSolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.BuyNft;
    } & ParsedBuyNftInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTokenPool;
    } & ParsedSellNftTokenPoolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTradePool;
    } & ParsedSellNftTradePoolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.BuyNftT22;
    } & ParsedBuyNftT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.DepositNftT22;
    } & ParsedDepositNftT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTokenPoolT22;
    } & ParsedSellNftTokenPoolT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTradePoolT22;
    } & ParsedSellNftTradePoolT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawNftT22;
    } & ParsedWithdrawNftT22Instruction<TProgram>);