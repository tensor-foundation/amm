pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA");

#[program]
pub mod amm_program {

    use super::*;

    pub fn create(ctx: Context<Create>, arg1: u16, arg2: u32) -> Result<()> {
        process_create(ctx, arg1, arg2)
    }
}
