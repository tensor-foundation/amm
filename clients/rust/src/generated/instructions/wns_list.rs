//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct WnsList {
    pub single_listing: solana_program::pubkey::Pubkey,

    pub nft_source: solana_program::pubkey::Pubkey,

    pub nft_mint: solana_program::pubkey::Pubkey,

    pub nft_escrow_owner: solana_program::pubkey::Pubkey,

    pub nft_escrow_token: solana_program::pubkey::Pubkey,

    pub owner: solana_program::pubkey::Pubkey,

    pub token_program: solana_program::pubkey::Pubkey,

    pub associated_token_program: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,

    pub payer: solana_program::pubkey::Pubkey,

    pub approve_account: solana_program::pubkey::Pubkey,

    pub distribution: solana_program::pubkey::Pubkey,

    pub wns_program: solana_program::pubkey::Pubkey,

    pub distribution_program: solana_program::pubkey::Pubkey,

    pub extra_metas: solana_program::pubkey::Pubkey,
}

impl WnsList {
    pub fn instruction(
        &self,
        args: WnsListInstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: WnsListInstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(15 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.single_listing,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.nft_source,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.nft_mint,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.nft_escrow_owner,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.nft_escrow_token,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner, true,
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.payer, true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.approve_account,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.distribution,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.wns_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.distribution_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.extra_metas,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = WnsListInstructionData::new().try_to_vec().unwrap();
        let mut args = args.try_to_vec().unwrap();
        data.append(&mut args);

        solana_program::instruction::Instruction {
            program_id: crate::AMM_ID,
            accounts,
            data,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
struct WnsListInstructionData {
    discriminator: [u8; 8],
}

impl WnsListInstructionData {
    fn new() -> Self {
        Self {
            discriminator: [212, 193, 161, 215, 128, 43, 190, 204],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct WnsListInstructionArgs {
    pub price: u64,
}

/// Instruction builder for `WnsList`.
///
/// ### Accounts:
///
///   0. `[writable]` single_listing
///   1. `[writable]` nft_source
///   2. `[]` nft_mint
///   3. `[writable]` nft_escrow_owner
///   4. `[writable]` nft_escrow_token
///   5. `[writable, signer]` owner
///   6. `[optional]` token_program (default to `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
///   7. `[]` associated_token_program
///   8. `[optional]` system_program (default to `11111111111111111111111111111111`)
///   9. `[writable, signer]` payer
///   10. `[writable]` approve_account
///   11. `[writable]` distribution
///   12. `[]` wns_program
///   13. `[]` distribution_program
///   14. `[]` extra_metas
#[derive(Default)]
pub struct WnsListBuilder {
    single_listing: Option<solana_program::pubkey::Pubkey>,
    nft_source: Option<solana_program::pubkey::Pubkey>,
    nft_mint: Option<solana_program::pubkey::Pubkey>,
    nft_escrow_owner: Option<solana_program::pubkey::Pubkey>,
    nft_escrow_token: Option<solana_program::pubkey::Pubkey>,
    owner: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    payer: Option<solana_program::pubkey::Pubkey>,
    approve_account: Option<solana_program::pubkey::Pubkey>,
    distribution: Option<solana_program::pubkey::Pubkey>,
    wns_program: Option<solana_program::pubkey::Pubkey>,
    distribution_program: Option<solana_program::pubkey::Pubkey>,
    extra_metas: Option<solana_program::pubkey::Pubkey>,
    price: Option<u64>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl WnsListBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn single_listing(&mut self, single_listing: solana_program::pubkey::Pubkey) -> &mut Self {
        self.single_listing = Some(single_listing);
        self
    }
    #[inline(always)]
    pub fn nft_source(&mut self, nft_source: solana_program::pubkey::Pubkey) -> &mut Self {
        self.nft_source = Some(nft_source);
        self
    }
    #[inline(always)]
    pub fn nft_mint(&mut self, nft_mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.nft_mint = Some(nft_mint);
        self
    }
    #[inline(always)]
    pub fn nft_escrow_owner(
        &mut self,
        nft_escrow_owner: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.nft_escrow_owner = Some(nft_escrow_owner);
        self
    }
    #[inline(always)]
    pub fn nft_escrow_token(
        &mut self,
        nft_escrow_token: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.nft_escrow_token = Some(nft_escrow_token);
        self
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    /// `[optional account, default to 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA']`
    #[inline(always)]
    pub fn token_program(&mut self, token_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.token_program = Some(token_program);
        self
    }
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.associated_token_program = Some(associated_token_program);
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn payer(&mut self, payer: solana_program::pubkey::Pubkey) -> &mut Self {
        self.payer = Some(payer);
        self
    }
    #[inline(always)]
    pub fn approve_account(
        &mut self,
        approve_account: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.approve_account = Some(approve_account);
        self
    }
    #[inline(always)]
    pub fn distribution(&mut self, distribution: solana_program::pubkey::Pubkey) -> &mut Self {
        self.distribution = Some(distribution);
        self
    }
    #[inline(always)]
    pub fn wns_program(&mut self, wns_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.wns_program = Some(wns_program);
        self
    }
    #[inline(always)]
    pub fn distribution_program(
        &mut self,
        distribution_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.distribution_program = Some(distribution_program);
        self
    }
    #[inline(always)]
    pub fn extra_metas(&mut self, extra_metas: solana_program::pubkey::Pubkey) -> &mut Self {
        self.extra_metas = Some(extra_metas);
        self
    }
    #[inline(always)]
    pub fn price(&mut self, price: u64) -> &mut Self {
        self.price = Some(price);
        self
    }
    /// Add an aditional account to the instruction.
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
        let accounts = WnsList {
            single_listing: self.single_listing.expect("single_listing is not set"),
            nft_source: self.nft_source.expect("nft_source is not set"),
            nft_mint: self.nft_mint.expect("nft_mint is not set"),
            nft_escrow_owner: self.nft_escrow_owner.expect("nft_escrow_owner is not set"),
            nft_escrow_token: self.nft_escrow_token.expect("nft_escrow_token is not set"),
            owner: self.owner.expect("owner is not set"),
            token_program: self.token_program.unwrap_or(solana_program::pubkey!(
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            )),
            associated_token_program: self
                .associated_token_program
                .expect("associated_token_program is not set"),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
            payer: self.payer.expect("payer is not set"),
            approve_account: self.approve_account.expect("approve_account is not set"),
            distribution: self.distribution.expect("distribution is not set"),
            wns_program: self.wns_program.expect("wns_program is not set"),
            distribution_program: self
                .distribution_program
                .expect("distribution_program is not set"),
            extra_metas: self.extra_metas.expect("extra_metas is not set"),
        };
        let args = WnsListInstructionArgs {
            price: self.price.clone().expect("price is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `wns_list` CPI accounts.
pub struct WnsListCpiAccounts<'a, 'b> {
    pub single_listing: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_source: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_escrow_owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_escrow_token: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub payer: &'b solana_program::account_info::AccountInfo<'a>,

    pub approve_account: &'b solana_program::account_info::AccountInfo<'a>,

    pub distribution: &'b solana_program::account_info::AccountInfo<'a>,

    pub wns_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub distribution_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub extra_metas: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `wns_list` CPI instruction.
pub struct WnsListCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub single_listing: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_source: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_escrow_owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_escrow_token: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub payer: &'b solana_program::account_info::AccountInfo<'a>,

    pub approve_account: &'b solana_program::account_info::AccountInfo<'a>,

    pub distribution: &'b solana_program::account_info::AccountInfo<'a>,

    pub wns_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub distribution_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub extra_metas: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: WnsListInstructionArgs,
}

impl<'a, 'b> WnsListCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: WnsListCpiAccounts<'a, 'b>,
        args: WnsListInstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            single_listing: accounts.single_listing,
            nft_source: accounts.nft_source,
            nft_mint: accounts.nft_mint,
            nft_escrow_owner: accounts.nft_escrow_owner,
            nft_escrow_token: accounts.nft_escrow_token,
            owner: accounts.owner,
            token_program: accounts.token_program,
            associated_token_program: accounts.associated_token_program,
            system_program: accounts.system_program,
            payer: accounts.payer,
            approve_account: accounts.approve_account,
            distribution: accounts.distribution,
            wns_program: accounts.wns_program,
            distribution_program: accounts.distribution_program,
            extra_metas: accounts.extra_metas,
            __args: args,
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
        let mut accounts = Vec::with_capacity(15 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.single_listing.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.nft_source.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.nft_mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.nft_escrow_owner.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.nft_escrow_token.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner.key,
            true,
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.payer.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.approve_account.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.distribution.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.wns_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.distribution_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.extra_metas.key,
            false,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = WnsListInstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(15 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.single_listing.clone());
        account_infos.push(self.nft_source.clone());
        account_infos.push(self.nft_mint.clone());
        account_infos.push(self.nft_escrow_owner.clone());
        account_infos.push(self.nft_escrow_token.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
        account_infos.push(self.system_program.clone());
        account_infos.push(self.payer.clone());
        account_infos.push(self.approve_account.clone());
        account_infos.push(self.distribution.clone());
        account_infos.push(self.wns_program.clone());
        account_infos.push(self.distribution_program.clone());
        account_infos.push(self.extra_metas.clone());
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

/// Instruction builder for `WnsList` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` single_listing
///   1. `[writable]` nft_source
///   2. `[]` nft_mint
///   3. `[writable]` nft_escrow_owner
///   4. `[writable]` nft_escrow_token
///   5. `[writable, signer]` owner
///   6. `[]` token_program
///   7. `[]` associated_token_program
///   8. `[]` system_program
///   9. `[writable, signer]` payer
///   10. `[writable]` approve_account
///   11. `[writable]` distribution
///   12. `[]` wns_program
///   13. `[]` distribution_program
///   14. `[]` extra_metas
pub struct WnsListCpiBuilder<'a, 'b> {
    instruction: Box<WnsListCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> WnsListCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(WnsListCpiBuilderInstruction {
            __program: program,
            single_listing: None,
            nft_source: None,
            nft_mint: None,
            nft_escrow_owner: None,
            nft_escrow_token: None,
            owner: None,
            token_program: None,
            associated_token_program: None,
            system_program: None,
            payer: None,
            approve_account: None,
            distribution: None,
            wns_program: None,
            distribution_program: None,
            extra_metas: None,
            price: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn single_listing(
        &mut self,
        single_listing: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.single_listing = Some(single_listing);
        self
    }
    #[inline(always)]
    pub fn nft_source(
        &mut self,
        nft_source: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_source = Some(nft_source);
        self
    }
    #[inline(always)]
    pub fn nft_mint(
        &mut self,
        nft_mint: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_mint = Some(nft_mint);
        self
    }
    #[inline(always)]
    pub fn nft_escrow_owner(
        &mut self,
        nft_escrow_owner: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_escrow_owner = Some(nft_escrow_owner);
        self
    }
    #[inline(always)]
    pub fn nft_escrow_token(
        &mut self,
        nft_escrow_token: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_escrow_token = Some(nft_escrow_token);
        self
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    #[inline(always)]
    pub fn token_program(
        &mut self,
        token_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_program = Some(token_program);
        self
    }
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.associated_token_program = Some(associated_token_program);
        self
    }
    #[inline(always)]
    pub fn system_program(
        &mut self,
        system_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn payer(&mut self, payer: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.payer = Some(payer);
        self
    }
    #[inline(always)]
    pub fn approve_account(
        &mut self,
        approve_account: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.approve_account = Some(approve_account);
        self
    }
    #[inline(always)]
    pub fn distribution(
        &mut self,
        distribution: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.distribution = Some(distribution);
        self
    }
    #[inline(always)]
    pub fn wns_program(
        &mut self,
        wns_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.wns_program = Some(wns_program);
        self
    }
    #[inline(always)]
    pub fn distribution_program(
        &mut self,
        distribution_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.distribution_program = Some(distribution_program);
        self
    }
    #[inline(always)]
    pub fn extra_metas(
        &mut self,
        extra_metas: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.extra_metas = Some(extra_metas);
        self
    }
    #[inline(always)]
    pub fn price(&mut self, price: u64) -> &mut Self {
        self.instruction.price = Some(price);
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
        let args = WnsListInstructionArgs {
            price: self.instruction.price.clone().expect("price is not set"),
        };
        let instruction = WnsListCpi {
            __program: self.instruction.__program,

            single_listing: self
                .instruction
                .single_listing
                .expect("single_listing is not set"),

            nft_source: self.instruction.nft_source.expect("nft_source is not set"),

            nft_mint: self.instruction.nft_mint.expect("nft_mint is not set"),

            nft_escrow_owner: self
                .instruction
                .nft_escrow_owner
                .expect("nft_escrow_owner is not set"),

            nft_escrow_token: self
                .instruction
                .nft_escrow_token
                .expect("nft_escrow_token is not set"),

            owner: self.instruction.owner.expect("owner is not set"),

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

            payer: self.instruction.payer.expect("payer is not set"),

            approve_account: self
                .instruction
                .approve_account
                .expect("approve_account is not set"),

            distribution: self
                .instruction
                .distribution
                .expect("distribution is not set"),

            wns_program: self
                .instruction
                .wns_program
                .expect("wns_program is not set"),

            distribution_program: self
                .instruction
                .distribution_program
                .expect("distribution_program is not set"),

            extra_metas: self
                .instruction
                .extra_metas
                .expect("extra_metas is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct WnsListCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    single_listing: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_source: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_escrow_owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_escrow_token: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    payer: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    approve_account: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    distribution: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    wns_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    distribution_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    extra_metas: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    price: Option<u64>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
