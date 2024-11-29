//! This code was AUTOGENERATED using the codama library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun codama to update it.
//!
//! <https://github.com/codama-idl/codama>
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct WithdrawNftT22 {
    /// The owner of the pool and the NFT.
    pub owner: solana_program::pubkey::Pubkey,
    /// The pool the NFT is being transferred to/from.
    pub pool: solana_program::pubkey::Pubkey,
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    pub whitelist: Option<solana_program::pubkey::Pubkey>,
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    pub mint_proof: Option<solana_program::pubkey::Pubkey>,
    /// The mint account of the NFT.
    pub mint: solana_program::pubkey::Pubkey,
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    pub nft_receipt: solana_program::pubkey::Pubkey,
    /// The TA of the owner where the NFT will be withdrawn to.
    pub owner_ta: solana_program::pubkey::Pubkey,
    /// The TA of the pool, where the NFT token is escrowed.
    pub pool_ta: solana_program::pubkey::Pubkey,
    /// The SPL Token program for the Mint and ATAs.
    pub token_program: solana_program::pubkey::Pubkey,
    /// The SPL associated token program.
    pub associated_token_program: solana_program::pubkey::Pubkey,
    /// The Solana system program.
    pub system_program: solana_program::pubkey::Pubkey,
}

impl WithdrawNftT22 {
    pub fn instruction(&self) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(&[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(11 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner, true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool, false,
        ));
        if let Some(whitelist) = self.whitelist {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                whitelist, false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        if let Some(mint_proof) = self.mint_proof {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                mint_proof, false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mint, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.nft_receipt,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner_ta,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool_ta,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.token_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.associated_token_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let data = WithdrawNftT22InstructionData::new().try_to_vec().unwrap();

        solana_program::instruction::Instruction {
            program_id: crate::TENSOR_AMM_ID,
            accounts,
            data,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct WithdrawNftT22InstructionData {
    discriminator: [u8; 8],
}

impl WithdrawNftT22InstructionData {
    pub fn new() -> Self {
        Self {
            discriminator: [112, 55, 80, 231, 181, 190, 92, 12],
        }
    }
}

impl Default for WithdrawNftT22InstructionData {
    fn default() -> Self {
        Self::new()
    }
}

/// Instruction builder for `WithdrawNftT22`.
///
/// ### Accounts:
///
///   0. `[writable, signer]` owner
///   1. `[writable]` pool
///   2. `[optional]` whitelist
///   3. `[optional]` mint_proof
///   4. `[]` mint
///   5. `[writable]` nft_receipt
///   6. `[writable]` owner_ta
///   7. `[writable]` pool_ta
///   8. `[optional]` token_program (default to `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
///   9. `[optional]` associated_token_program (default to `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`)
///   10. `[optional]` system_program (default to `11111111111111111111111111111111`)
#[derive(Clone, Debug, Default)]
pub struct WithdrawNftT22Builder {
    owner: Option<solana_program::pubkey::Pubkey>,
    pool: Option<solana_program::pubkey::Pubkey>,
    whitelist: Option<solana_program::pubkey::Pubkey>,
    mint_proof: Option<solana_program::pubkey::Pubkey>,
    mint: Option<solana_program::pubkey::Pubkey>,
    nft_receipt: Option<solana_program::pubkey::Pubkey>,
    owner_ta: Option<solana_program::pubkey::Pubkey>,
    pool_ta: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl WithdrawNftT22Builder {
    pub fn new() -> Self {
        Self::default()
    }
    /// The owner of the pool and the NFT.
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    /// The pool the NFT is being transferred to/from.
    #[inline(always)]
    pub fn pool(&mut self, pool: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool = Some(pool);
        self
    }
    /// `[optional account]`
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[inline(always)]
    pub fn whitelist(&mut self, whitelist: Option<solana_program::pubkey::Pubkey>) -> &mut Self {
        self.whitelist = whitelist;
        self
    }
    /// `[optional account]`
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    #[inline(always)]
    pub fn mint_proof(&mut self, mint_proof: Option<solana_program::pubkey::Pubkey>) -> &mut Self {
        self.mint_proof = mint_proof;
        self
    }
    /// The mint account of the NFT.
    #[inline(always)]
    pub fn mint(&mut self, mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint = Some(mint);
        self
    }
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[inline(always)]
    pub fn nft_receipt(&mut self, nft_receipt: solana_program::pubkey::Pubkey) -> &mut Self {
        self.nft_receipt = Some(nft_receipt);
        self
    }
    /// The TA of the owner where the NFT will be withdrawn to.
    #[inline(always)]
    pub fn owner_ta(&mut self, owner_ta: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner_ta = Some(owner_ta);
        self
    }
    /// The TA of the pool, where the NFT token is escrowed.
    #[inline(always)]
    pub fn pool_ta(&mut self, pool_ta: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool_ta = Some(pool_ta);
        self
    }
    /// `[optional account, default to 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']`
    /// The SPL Token program for the Mint and ATAs.
    #[inline(always)]
    pub fn token_program(&mut self, token_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.token_program = Some(token_program);
        self
    }
    /// `[optional account, default to 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL']`
    /// The SPL associated token program.
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.associated_token_program = Some(associated_token_program);
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    /// The Solana system program.
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    /// Add an additional account to the instruction.
    #[inline(always)]
    pub fn add_remaining_account(
        &mut self,
        account: solana_program::instruction::AccountMeta,
    ) -> &mut Self {
        self.__remaining_accounts.push(account);
        self
    }
    /// Add additional accounts to the instruction.
    #[inline(always)]
    pub fn add_remaining_accounts(
        &mut self,
        accounts: &[solana_program::instruction::AccountMeta],
    ) -> &mut Self {
        self.__remaining_accounts.extend_from_slice(accounts);
        self
    }
    #[allow(clippy::clone_on_copy)]
    pub fn instruction(&self) -> solana_program::instruction::Instruction {
        let accounts = WithdrawNftT22 {
            owner: self.owner.expect("owner is not set"),
            pool: self.pool.expect("pool is not set"),
            whitelist: self.whitelist,
            mint_proof: self.mint_proof,
            mint: self.mint.expect("mint is not set"),
            nft_receipt: self.nft_receipt.expect("nft_receipt is not set"),
            owner_ta: self.owner_ta.expect("owner_ta is not set"),
            pool_ta: self.pool_ta.expect("pool_ta is not set"),
            token_program: self.token_program.unwrap_or(solana_program::pubkey!(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
            )),
            associated_token_program: self.associated_token_program.unwrap_or(
                solana_program::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
            ),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
        };

        accounts.instruction_with_remaining_accounts(&self.__remaining_accounts)
    }
}

/// `withdraw_nft_t22` CPI accounts.
pub struct WithdrawNftT22CpiAccounts<'a, 'b> {
    /// The owner of the pool and the NFT.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool the NFT is being transferred to/from.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    pub whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    pub mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The mint account of the NFT.
    pub mint: &'b solana_program::account_info::AccountInfo<'a>,
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    /// The TA of the owner where the NFT will be withdrawn to.
    pub owner_ta: &'b solana_program::account_info::AccountInfo<'a>,
    /// The TA of the pool, where the NFT token is escrowed.
    pub pool_ta: &'b solana_program::account_info::AccountInfo<'a>,
    /// The SPL Token program for the Mint and ATAs.
    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The SPL associated token program.
    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Solana system program.
    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `withdraw_nft_t22` CPI instruction.
pub struct WithdrawNftT22Cpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The owner of the pool and the NFT.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool the NFT is being transferred to/from.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    pub whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    pub mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The mint account of the NFT.
    pub mint: &'b solana_program::account_info::AccountInfo<'a>,
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    /// The TA of the owner where the NFT will be withdrawn to.
    pub owner_ta: &'b solana_program::account_info::AccountInfo<'a>,
    /// The TA of the pool, where the NFT token is escrowed.
    pub pool_ta: &'b solana_program::account_info::AccountInfo<'a>,
    /// The SPL Token program for the Mint and ATAs.
    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The SPL associated token program.
    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Solana system program.
    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

impl<'a, 'b> WithdrawNftT22Cpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: WithdrawNftT22CpiAccounts<'a, 'b>,
    ) -> Self {
        Self {
            __program: program,
            owner: accounts.owner,
            pool: accounts.pool,
            whitelist: accounts.whitelist,
            mint_proof: accounts.mint_proof,
            mint: accounts.mint,
            nft_receipt: accounts.nft_receipt,
            owner_ta: accounts.owner_ta,
            pool_ta: accounts.pool_ta,
            token_program: accounts.token_program,
            associated_token_program: accounts.associated_token_program,
            system_program: accounts.system_program,
        }
    }
    #[inline(always)]
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(&[], &[])
    }
    #[inline(always)]
    pub fn invoke_with_remaining_accounts(
        &self,
        remaining_accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(&[], remaining_accounts)
    }
    #[inline(always)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(signers_seeds, &[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed_with_remaining_accounts(
        &self,
        signers_seeds: &[&[&[u8]]],
        remaining_accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> solana_program::entrypoint::ProgramResult {
        let mut accounts = Vec::with_capacity(11 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool.key,
            false,
        ));
        if let Some(whitelist) = self.whitelist {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *whitelist.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        if let Some(mint_proof) = self.mint_proof {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *mint_proof.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.nft_receipt.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner_ta.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool_ta.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.token_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.associated_token_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.system_program.key,
            false,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let data = WithdrawNftT22InstructionData::new().try_to_vec().unwrap();

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::TENSOR_AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(12 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.pool.clone());
        if let Some(whitelist) = self.whitelist {
            account_infos.push(whitelist.clone());
        }
        if let Some(mint_proof) = self.mint_proof {
            account_infos.push(mint_proof.clone());
        }
        account_infos.push(self.mint.clone());
        account_infos.push(self.nft_receipt.clone());
        account_infos.push(self.owner_ta.clone());
        account_infos.push(self.pool_ta.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
        account_infos.push(self.system_program.clone());
        remaining_accounts
            .iter()
            .for_each(|remaining_account| account_infos.push(remaining_account.0.clone()));

        if signers_seeds.is_empty() {
            solana_program::program::invoke(&instruction, &account_infos)
        } else {
            solana_program::program::invoke_signed(&instruction, &account_infos, signers_seeds)
        }
    }
}

/// Instruction builder for `WithdrawNftT22` via CPI.
///
/// ### Accounts:
///
///   0. `[writable, signer]` owner
///   1. `[writable]` pool
///   2. `[optional]` whitelist
///   3. `[optional]` mint_proof
///   4. `[]` mint
///   5. `[writable]` nft_receipt
///   6. `[writable]` owner_ta
///   7. `[writable]` pool_ta
///   8. `[]` token_program
///   9. `[]` associated_token_program
///   10. `[]` system_program
#[derive(Clone, Debug)]
pub struct WithdrawNftT22CpiBuilder<'a, 'b> {
    instruction: Box<WithdrawNftT22CpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> WithdrawNftT22CpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(WithdrawNftT22CpiBuilderInstruction {
            __program: program,
            owner: None,
            pool: None,
            whitelist: None,
            mint_proof: None,
            mint: None,
            nft_receipt: None,
            owner_ta: None,
            pool_ta: None,
            token_program: None,
            associated_token_program: None,
            system_program: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    /// The owner of the pool and the NFT.
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    /// The pool the NFT is being transferred to/from.
    #[inline(always)]
    pub fn pool(&mut self, pool: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.pool = Some(pool);
        self
    }
    /// `[optional account]`
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[inline(always)]
    pub fn whitelist(
        &mut self,
        whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.whitelist = whitelist;
        self
    }
    /// `[optional account]`
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    #[inline(always)]
    pub fn mint_proof(
        &mut self,
        mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.mint_proof = mint_proof;
        self
    }
    /// The mint account of the NFT.
    #[inline(always)]
    pub fn mint(&mut self, mint: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.mint = Some(mint);
        self
    }
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[inline(always)]
    pub fn nft_receipt(
        &mut self,
        nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_receipt = Some(nft_receipt);
        self
    }
    /// The TA of the owner where the NFT will be withdrawn to.
    #[inline(always)]
    pub fn owner_ta(
        &mut self,
        owner_ta: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.owner_ta = Some(owner_ta);
        self
    }
    /// The TA of the pool, where the NFT token is escrowed.
    #[inline(always)]
    pub fn pool_ta(
        &mut self,
        pool_ta: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.pool_ta = Some(pool_ta);
        self
    }
    /// The SPL Token program for the Mint and ATAs.
    #[inline(always)]
    pub fn token_program(
        &mut self,
        token_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_program = Some(token_program);
        self
    }
    /// The SPL associated token program.
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.associated_token_program = Some(associated_token_program);
        self
    }
    /// The Solana system program.
    #[inline(always)]
    pub fn system_program(
        &mut self,
        system_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.system_program = Some(system_program);
        self
    }
    /// Add an additional account to the instruction.
    #[inline(always)]
    pub fn add_remaining_account(
        &mut self,
        account: &'b solana_program::account_info::AccountInfo<'a>,
        is_writable: bool,
        is_signer: bool,
    ) -> &mut Self {
        self.instruction
            .__remaining_accounts
            .push((account, is_writable, is_signer));
        self
    }
    /// Add additional accounts to the instruction.
    ///
    /// Each account is represented by a tuple of the `AccountInfo`, a `bool` indicating whether the account is writable or not,
    /// and a `bool` indicating whether the account is a signer or not.
    #[inline(always)]
    pub fn add_remaining_accounts(
        &mut self,
        accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> &mut Self {
        self.instruction
            .__remaining_accounts
            .extend_from_slice(accounts);
        self
    }
    #[inline(always)]
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed(&[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        let instruction = WithdrawNftT22Cpi {
            __program: self.instruction.__program,

            owner: self.instruction.owner.expect("owner is not set"),

            pool: self.instruction.pool.expect("pool is not set"),

            whitelist: self.instruction.whitelist,

            mint_proof: self.instruction.mint_proof,

            mint: self.instruction.mint.expect("mint is not set"),

            nft_receipt: self
                .instruction
                .nft_receipt
                .expect("nft_receipt is not set"),

            owner_ta: self.instruction.owner_ta.expect("owner_ta is not set"),

            pool_ta: self.instruction.pool_ta.expect("pool_ta is not set"),

            token_program: self
                .instruction
                .token_program
                .expect("token_program is not set"),

            associated_token_program: self
                .instruction
                .associated_token_program
                .expect("associated_token_program is not set"),

            system_program: self
                .instruction
                .system_program
                .expect("system_program is not set"),
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

#[derive(Clone, Debug)]
struct WithdrawNftT22CpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_receipt: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner_ta: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool_ta: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
