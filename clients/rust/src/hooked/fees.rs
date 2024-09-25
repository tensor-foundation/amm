use borsh::{BorshDeserialize, BorshSerialize};

use crate::errors::TensorAmmError;

use super::{BROKER_FEE_PCT, HUNDRED_PCT_BPS, MAKER_BROKER_PCT, TAKER_FEE_BPS};

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Fees {
    pub taker_fee: u64,
    pub protocol_fee: u64,
    pub maker_broker_fee: u64,
    pub taker_broker_fee: u64,
}

pub fn calc_fees(amount: u64) -> Result<Fees, TensorAmmError> {
    // Taker fee: protocol and broker fees.
    let taker_fee = TAKER_FEE_BPS
        .checked_mul(amount)
        .ok_or(TensorAmmError::ArithmeticError)?
        .checked_div(HUNDRED_PCT_BPS as u64)
        .ok_or(TensorAmmError::ArithmeticError)?;

    // Broker fees are a percentage of the taker fee.
    let broker_fees = BROKER_FEE_PCT
        .checked_mul(taker_fee)
        .ok_or(TensorAmmError::ArithmeticError)?
        .checked_div(100u64)
        .ok_or(TensorAmmError::ArithmeticError)?;

    // The protocol is the remainder of the taker fee.
    let protocol_fee = taker_fee
        .checked_sub(broker_fees)
        .ok_or(TensorAmmError::ArithmeticError)?;

    // Maker broker fee calculated as a percentage of the total brokers fee.
    let maker_broker_fee = (MAKER_BROKER_PCT as u64)
        .checked_mul(broker_fees)
        .ok_or(TensorAmmError::ArithmeticError)?
        .checked_div(100u64)
        .ok_or(TensorAmmError::ArithmeticError)?;

    // Remaining broker fee is the taker broker fee.
    let taker_broker_fee = broker_fees
        .checked_sub(maker_broker_fee)
        .ok_or(TensorAmmError::ArithmeticError)?;

    Ok(Fees {
        taker_fee,
        protocol_fee,
        maker_broker_fee,
        taker_broker_fee,
    })
}
