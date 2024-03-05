use anchor_lang::prelude::*;

#[error_code]
pub enum ProjectNameError {
    /// 0 - Invalid authority
    #[msg("Invalid authority for account")]
    InvalidAuthority,
}
