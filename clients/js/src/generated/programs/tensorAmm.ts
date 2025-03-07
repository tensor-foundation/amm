/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  containsBytes,
  fixEncoderSize,
  getBytesEncoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/web3.js';
import {
  type ParsedBuyNftCoreInstruction,
  type ParsedBuyNftInstruction,
  type ParsedBuyNftT22Instruction,
  type ParsedCloseExpiredPoolInstruction,
  type ParsedClosePoolInstruction,
  type ParsedCreatePoolInstruction,
  type ParsedDepositNftCoreInstruction,
  type ParsedDepositNftInstruction,
  type ParsedDepositNftT22Instruction,
  type ParsedDepositSolInstruction,
  type ParsedEditPoolInstruction,
  type ParsedSellNftTokenPoolCoreInstruction,
  type ParsedSellNftTokenPoolInstruction,
  type ParsedSellNftTokenPoolT22Instruction,
  type ParsedSellNftTradePoolCoreInstruction,
  type ParsedSellNftTradePoolInstruction,
  type ParsedSellNftTradePoolT22Instruction,
  type ParsedTammNoopInstruction,
  type ParsedWithdrawNftCoreInstruction,
  type ParsedWithdrawNftInstruction,
  type ParsedWithdrawNftT22Instruction,
  type ParsedWithdrawSolInstruction,
} from '../instructions';

export const TENSOR_AMM_PROGRAM_ADDRESS =
  'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg' as Address<'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg'>;

export enum TensorAmmAccount {
  AssetDepositReceipt,
  NftDepositReceipt,
  Pool,
}

export function identifyTensorAmmAccount(
  account: { data: ReadonlyUint8Array } | ReadonlyUint8Array
): TensorAmmAccount {
  const data = 'data' in account ? account.data : account;
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([147, 18, 99, 58, 249, 8, 196, 221])
      ),
      0
    )
  ) {
    return TensorAmmAccount.AssetDepositReceipt;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([206, 255, 132, 254, 67, 78, 62, 96])
      ),
      0
    )
  ) {
    return TensorAmmAccount.NftDepositReceipt;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([241, 154, 109, 4, 17, 177, 109, 188])
      ),
      0
    )
  ) {
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
  DepositSol,
  WithdrawSol,
  DepositNft,
  WithdrawNft,
  BuyNft,
  SellNftTokenPool,
  SellNftTradePool,
  DepositNftCore,
  WithdrawNftCore,
  BuyNftCore,
  SellNftTokenPoolCore,
  SellNftTradePoolCore,
  DepositNftT22,
  WithdrawNftT22,
  BuyNftT22,
  SellNftTokenPoolT22,
  SellNftTradePoolT22,
}

export function identifyTensorAmmInstruction(
  instruction: { data: ReadonlyUint8Array } | ReadonlyUint8Array
): TensorAmmInstruction {
  const data = 'data' in instruction ? instruction.data : instruction;
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([31, 162, 228, 158, 153, 160, 198, 182])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.TammNoop;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([233, 146, 209, 142, 207, 104, 64, 188])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.CreatePool;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([50, 174, 34, 36, 3, 166, 29, 204])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.EditPool;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([140, 189, 209, 23, 239, 62, 239, 11])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.ClosePool;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([108, 212, 233, 53, 132, 83, 63, 219])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.CloseExpiredPool;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([108, 81, 78, 117, 125, 155, 56, 200])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.DepositSol;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([145, 131, 74, 136, 65, 137, 42, 38])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.WithdrawSol;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([93, 226, 132, 166, 141, 9, 48, 101])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.DepositNft;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([142, 181, 191, 149, 82, 175, 216, 100])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.WithdrawNft;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([96, 0, 28, 190, 49, 107, 83, 222])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.BuyNft;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([57, 44, 192, 48, 83, 8, 107, 48])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.SellNftTokenPool;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([131, 82, 125, 77, 13, 157, 36, 90])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.SellNftTradePool;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([73, 21, 4, 64, 161, 214, 248, 77])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.DepositNftCore;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([112, 131, 239, 116, 187, 149, 114, 145])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.WithdrawNftCore;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([163, 102, 58, 107, 184, 4, 169, 121])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.BuyNftCore;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([137, 227, 197, 122, 245, 229, 56, 205])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.SellNftTokenPoolCore;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([37, 205, 141, 53, 86, 245, 45, 78])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.SellNftTradePoolCore;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([208, 34, 6, 147, 95, 218, 49, 160])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.DepositNftT22;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([112, 55, 80, 231, 181, 190, 92, 12])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.WithdrawNftT22;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([155, 219, 126, 245, 170, 199, 51, 79])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.BuyNftT22;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([149, 234, 31, 103, 26, 36, 166, 49])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.SellNftTokenPoolT22;
  }
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([124, 145, 23, 52, 72, 113, 85, 9])
      ),
      0
    )
  ) {
    return TensorAmmInstruction.SellNftTradePoolT22;
  }
  throw new Error(
    'The provided instruction could not be identified as a tensorAmm instruction.'
  );
}

export type ParsedTensorAmmInstruction<
  TProgram extends string = 'TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg',
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
      instructionType: TensorAmmInstruction.DepositSol;
    } & ParsedDepositSolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawSol;
    } & ParsedWithdrawSolInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.DepositNft;
    } & ParsedDepositNftInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawNft;
    } & ParsedWithdrawNftInstruction<TProgram>)
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
      instructionType: TensorAmmInstruction.DepositNftCore;
    } & ParsedDepositNftCoreInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawNftCore;
    } & ParsedWithdrawNftCoreInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.BuyNftCore;
    } & ParsedBuyNftCoreInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTokenPoolCore;
    } & ParsedSellNftTokenPoolCoreInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTradePoolCore;
    } & ParsedSellNftTradePoolCoreInstruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.DepositNftT22;
    } & ParsedDepositNftT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.WithdrawNftT22;
    } & ParsedWithdrawNftT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.BuyNftT22;
    } & ParsedBuyNftT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTokenPoolT22;
    } & ParsedSellNftTokenPoolT22Instruction<TProgram>)
  | ({
      instructionType: TensorAmmInstruction.SellNftTradePoolT22;
    } & ParsedSellNftTradePoolT22Instruction<TProgram>);
