pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("MyProgram1111111111111111111111111111111111");

#[program]
pub mod project_name_program {

    use super::*;

    pub fn create(ctx: Context<Create>, arg1: u16, arg2: u32) -> Result<()> {
        process_create(ctx, arg1, arg2)
    }
}
