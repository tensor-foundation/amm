use anchor_lang::prelude::*;

#[error_code]
pub enum AmmError {
    /// 0 - Invalid authority
    #[msg("Invalid authority for account")]
    InvalidAuthority,
}
