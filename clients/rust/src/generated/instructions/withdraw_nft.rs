//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::AuthorizationDataLocal;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct WithdrawNft {
    /// The owner of the pool and will receive the NFT at the owner_ata account.
    pub owner: solana_program::pubkey::Pubkey,
    /// The pool from which the NFT will be withdrawn.
    pub pool: solana_program::pubkey::Pubkey,

    pub mint: solana_program::pubkey::Pubkey,
    /// The ATA of the owner, where the NFT will be transferred to as a result of this action.
    pub owner_ata: solana_program::pubkey::Pubkey,
    /// The ATA of the pool, where the NFT token is escrowed.
    pub pool_ata: solana_program::pubkey::Pubkey,

    pub nft_receipt: solana_program::pubkey::Pubkey,

    pub token_program: solana_program::pubkey::Pubkey,

    pub associated_token_program: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,

    pub metadata: solana_program::pubkey::Pubkey,

    pub edition: solana_program::pubkey::Pubkey,

    pub owner_token_record: solana_program::pubkey::Pubkey,
    /// The Token Metadata pool temporary token record account of the NFT.
    pub pool_token_record: solana_program::pubkey::Pubkey,
    /// The Token Metadata program account.
    pub token_metadata_program: solana_program::pubkey::Pubkey,
    /// The sysvar instructions account.
    pub instructions: solana_program::pubkey::Pubkey,
    /// The Metaplex Token Authority Rules program account.
    pub authorization_rules_program: solana_program::pubkey::Pubkey,
    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    pub auth_rules: solana_program::pubkey::Pubkey,
}

impl WithdrawNft {
    pub fn instruction(
        &self,
        args: WithdrawNftInstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: WithdrawNftInstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(17 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner, true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mint, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner_ata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool_ata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.nft_receipt,
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.metadata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.edition,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner_token_record,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool_token_record,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.token_metadata_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.instructions,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.authorization_rules_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.auth_rules,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = WithdrawNftInstructionData::new().try_to_vec().unwrap();
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
pub struct WithdrawNftInstructionData {
    discriminator: [u8; 8],
}

impl WithdrawNftInstructionData {
    pub fn new() -> Self {
        Self {
            discriminator: [142, 181, 191, 149, 82, 175, 216, 100],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct WithdrawNftInstructionArgs {
    pub authorization_data: Option<AuthorizationDataLocal>,
    pub rules_acc_present: bool,
}

/// Instruction builder for `WithdrawNft`.
///
/// ### Accounts:
///
///   0. `[writable, signer]` owner
///   1. `[writable]` pool
///   2. `[]` mint
///   3. `[writable]` owner_ata
///   4. `[writable]` pool_ata
///   5. `[writable]` nft_receipt
///   6. `[optional]` token_program (default to `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
///   7. `[]` associated_token_program
///   8. `[optional]` system_program (default to `11111111111111111111111111111111`)
///   9. `[writable]` metadata
///   10. `[]` edition
///   11. `[writable]` owner_token_record
///   12. `[writable]` pool_token_record
///   13. `[optional]` token_metadata_program (default to `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`)
///   14. `[]` instructions
///   15. `[optional]` authorization_rules_program (default to `auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg`)
///   16. `[]` auth_rules
#[derive(Default)]
pub struct WithdrawNftBuilder {
    owner: Option<solana_program::pubkey::Pubkey>,
    pool: Option<solana_program::pubkey::Pubkey>,
    mint: Option<solana_program::pubkey::Pubkey>,
    owner_ata: Option<solana_program::pubkey::Pubkey>,
    pool_ata: Option<solana_program::pubkey::Pubkey>,
    nft_receipt: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    metadata: Option<solana_program::pubkey::Pubkey>,
    edition: Option<solana_program::pubkey::Pubkey>,
    owner_token_record: Option<solana_program::pubkey::Pubkey>,
    pool_token_record: Option<solana_program::pubkey::Pubkey>,
    token_metadata_program: Option<solana_program::pubkey::Pubkey>,
    instructions: Option<solana_program::pubkey::Pubkey>,
    authorization_rules_program: Option<solana_program::pubkey::Pubkey>,
    auth_rules: Option<solana_program::pubkey::Pubkey>,
    authorization_data: Option<AuthorizationDataLocal>,
    rules_acc_present: Option<bool>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl WithdrawNftBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    /// The owner of the pool and will receive the NFT at the owner_ata account.
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    /// The pool from which the NFT will be withdrawn.
    #[inline(always)]
    pub fn pool(&mut self, pool: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool = Some(pool);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint = Some(mint);
        self
    }
    /// The ATA of the owner, where the NFT will be transferred to as a result of this action.
    #[inline(always)]
    pub fn owner_ata(&mut self, owner_ata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner_ata = Some(owner_ata);
        self
    }
    /// The ATA of the pool, where the NFT token is escrowed.
    #[inline(always)]
    pub fn pool_ata(&mut self, pool_ata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool_ata = Some(pool_ata);
        self
    }
    #[inline(always)]
    pub fn nft_receipt(&mut self, nft_receipt: solana_program::pubkey::Pubkey) -> &mut Self {
        self.nft_receipt = Some(nft_receipt);
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
    pub fn metadata(&mut self, metadata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.metadata = Some(metadata);
        self
    }
    #[inline(always)]
    pub fn edition(&mut self, edition: solana_program::pubkey::Pubkey) -> &mut Self {
        self.edition = Some(edition);
        self
    }
    #[inline(always)]
    pub fn owner_token_record(
        &mut self,
        owner_token_record: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.owner_token_record = Some(owner_token_record);
        self
    }
    /// The Token Metadata pool temporary token record account of the NFT.
    #[inline(always)]
    pub fn pool_token_record(
        &mut self,
        pool_token_record: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.pool_token_record = Some(pool_token_record);
        self
    }
    /// `[optional account, default to 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s']`
    /// The Token Metadata program account.
    #[inline(always)]
    pub fn token_metadata_program(
        &mut self,
        token_metadata_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.token_metadata_program = Some(token_metadata_program);
        self
    }
    /// The sysvar instructions account.
    #[inline(always)]
    pub fn instructions(&mut self, instructions: solana_program::pubkey::Pubkey) -> &mut Self {
        self.instructions = Some(instructions);
        self
    }
    /// `[optional account, default to 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg']`
    /// The Metaplex Token Authority Rules program account.
    #[inline(always)]
    pub fn authorization_rules_program(
        &mut self,
        authorization_rules_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.authorization_rules_program = Some(authorization_rules_program);
        self
    }
    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    #[inline(always)]
    pub fn auth_rules(&mut self, auth_rules: solana_program::pubkey::Pubkey) -> &mut Self {
        self.auth_rules = Some(auth_rules);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn authorization_data(&mut self, authorization_data: AuthorizationDataLocal) -> &mut Self {
        self.authorization_data = Some(authorization_data);
        self
    }
    #[inline(always)]
    pub fn rules_acc_present(&mut self, rules_acc_present: bool) -> &mut Self {
        self.rules_acc_present = Some(rules_acc_present);
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
        let accounts =
            WithdrawNft {
                owner: self.owner.expect("owner is not set"),
                pool: self.pool.expect("pool is not set"),
                mint: self.mint.expect("mint is not set"),
                owner_ata: self.owner_ata.expect("owner_ata is not set"),
                pool_ata: self.pool_ata.expect("pool_ata is not set"),
                nft_receipt: self.nft_receipt.expect("nft_receipt is not set"),
                token_program: self.token_program.unwrap_or(solana_program::pubkey!(
                    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
                )),
                associated_token_program: self
                    .associated_token_program
                    .expect("associated_token_program is not set"),
                system_program: self
                    .system_program
                    .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
                metadata: self.metadata.expect("metadata is not set"),
                edition: self.edition.expect("edition is not set"),
                owner_token_record: self
                    .owner_token_record
                    .expect("owner_token_record is not set"),
                pool_token_record: self
                    .pool_token_record
                    .expect("pool_token_record is not set"),
                token_metadata_program: self.token_metadata_program.unwrap_or(
                    solana_program::pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
                ),
                instructions: self.instructions.expect("instructions is not set"),
                authorization_rules_program: self.authorization_rules_program.unwrap_or(
                    solana_program::pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg"),
                ),
                auth_rules: self.auth_rules.expect("auth_rules is not set"),
            };
        let args = WithdrawNftInstructionArgs {
            authorization_data: self.authorization_data.clone(),
            rules_acc_present: self
                .rules_acc_present
                .clone()
                .expect("rules_acc_present is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `withdraw_nft` CPI accounts.
pub struct WithdrawNftCpiAccounts<'a, 'b> {
    /// The owner of the pool and will receive the NFT at the owner_ata account.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool from which the NFT will be withdrawn.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the owner, where the NFT will be transferred to as a result of this action.
    pub owner_ata: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the pool, where the NFT token is escrowed.
    pub pool_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub metadata: &'b solana_program::account_info::AccountInfo<'a>,

    pub edition: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner_token_record: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Token Metadata pool temporary token record account of the NFT.
    pub pool_token_record: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Token Metadata program account.
    pub token_metadata_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The sysvar instructions account.
    pub instructions: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Metaplex Token Authority Rules program account.
    pub authorization_rules_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    pub auth_rules: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `withdraw_nft` CPI instruction.
pub struct WithdrawNftCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The owner of the pool and will receive the NFT at the owner_ata account.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool from which the NFT will be withdrawn.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the owner, where the NFT will be transferred to as a result of this action.
    pub owner_ata: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the pool, where the NFT token is escrowed.
    pub pool_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub metadata: &'b solana_program::account_info::AccountInfo<'a>,

    pub edition: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner_token_record: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Token Metadata pool temporary token record account of the NFT.
    pub pool_token_record: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Token Metadata program account.
    pub token_metadata_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The sysvar instructions account.
    pub instructions: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Metaplex Token Authority Rules program account.
    pub authorization_rules_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    pub auth_rules: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: WithdrawNftInstructionArgs,
}

impl<'a, 'b> WithdrawNftCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: WithdrawNftCpiAccounts<'a, 'b>,
        args: WithdrawNftInstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            owner: accounts.owner,
            pool: accounts.pool,
            mint: accounts.mint,
            owner_ata: accounts.owner_ata,
            pool_ata: accounts.pool_ata,
            nft_receipt: accounts.nft_receipt,
            token_program: accounts.token_program,
            associated_token_program: accounts.associated_token_program,
            system_program: accounts.system_program,
            metadata: accounts.metadata,
            edition: accounts.edition,
            owner_token_record: accounts.owner_token_record,
            pool_token_record: accounts.pool_token_record,
            token_metadata_program: accounts.token_metadata_program,
            instructions: accounts.instructions,
            authorization_rules_program: accounts.authorization_rules_program,
            auth_rules: accounts.auth_rules,
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
        let mut accounts = Vec::with_capacity(17 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner_ata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool_ata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.nft_receipt.key,
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.metadata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.edition.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner_token_record.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool_token_record.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.token_metadata_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.instructions.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.authorization_rules_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.auth_rules.key,
            false,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = WithdrawNftInstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(17 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.pool.clone());
        account_infos.push(self.mint.clone());
        account_infos.push(self.owner_ata.clone());
        account_infos.push(self.pool_ata.clone());
        account_infos.push(self.nft_receipt.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
        account_infos.push(self.system_program.clone());
        account_infos.push(self.metadata.clone());
        account_infos.push(self.edition.clone());
        account_infos.push(self.owner_token_record.clone());
        account_infos.push(self.pool_token_record.clone());
        account_infos.push(self.token_metadata_program.clone());
        account_infos.push(self.instructions.clone());
        account_infos.push(self.authorization_rules_program.clone());
        account_infos.push(self.auth_rules.clone());
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

/// Instruction builder for `WithdrawNft` via CPI.
///
/// ### Accounts:
///
///   0. `[writable, signer]` owner
///   1. `[writable]` pool
///   2. `[]` mint
///   3. `[writable]` owner_ata
///   4. `[writable]` pool_ata
///   5. `[writable]` nft_receipt
///   6. `[]` token_program
///   7. `[]` associated_token_program
///   8. `[]` system_program
///   9. `[writable]` metadata
///   10. `[]` edition
///   11. `[writable]` owner_token_record
///   12. `[writable]` pool_token_record
///   13. `[]` token_metadata_program
///   14. `[]` instructions
///   15. `[]` authorization_rules_program
///   16. `[]` auth_rules
pub struct WithdrawNftCpiBuilder<'a, 'b> {
    instruction: Box<WithdrawNftCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> WithdrawNftCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(WithdrawNftCpiBuilderInstruction {
            __program: program,
            owner: None,
            pool: None,
            mint: None,
            owner_ata: None,
            pool_ata: None,
            nft_receipt: None,
            token_program: None,
            associated_token_program: None,
            system_program: None,
            metadata: None,
            edition: None,
            owner_token_record: None,
            pool_token_record: None,
            token_metadata_program: None,
            instructions: None,
            authorization_rules_program: None,
            auth_rules: None,
            authorization_data: None,
            rules_acc_present: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    /// The owner of the pool and will receive the NFT at the owner_ata account.
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    /// The pool from which the NFT will be withdrawn.
    #[inline(always)]
    pub fn pool(&mut self, pool: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.pool = Some(pool);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.mint = Some(mint);
        self
    }
    /// The ATA of the owner, where the NFT will be transferred to as a result of this action.
    #[inline(always)]
    pub fn owner_ata(
        &mut self,
        owner_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.owner_ata = Some(owner_ata);
        self
    }
    /// The ATA of the pool, where the NFT token is escrowed.
    #[inline(always)]
    pub fn pool_ata(
        &mut self,
        pool_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.pool_ata = Some(pool_ata);
        self
    }
    #[inline(always)]
    pub fn nft_receipt(
        &mut self,
        nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_receipt = Some(nft_receipt);
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
    pub fn metadata(
        &mut self,
        metadata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.metadata = Some(metadata);
        self
    }
    #[inline(always)]
    pub fn edition(
        &mut self,
        edition: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.edition = Some(edition);
        self
    }
    #[inline(always)]
    pub fn owner_token_record(
        &mut self,
        owner_token_record: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.owner_token_record = Some(owner_token_record);
        self
    }
    /// The Token Metadata pool temporary token record account of the NFT.
    #[inline(always)]
    pub fn pool_token_record(
        &mut self,
        pool_token_record: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.pool_token_record = Some(pool_token_record);
        self
    }
    /// The Token Metadata program account.
    #[inline(always)]
    pub fn token_metadata_program(
        &mut self,
        token_metadata_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_metadata_program = Some(token_metadata_program);
        self
    }
    /// The sysvar instructions account.
    #[inline(always)]
    pub fn instructions(
        &mut self,
        instructions: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.instructions = Some(instructions);
        self
    }
    /// The Metaplex Token Authority Rules program account.
    #[inline(always)]
    pub fn authorization_rules_program(
        &mut self,
        authorization_rules_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.authorization_rules_program = Some(authorization_rules_program);
        self
    }
    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    #[inline(always)]
    pub fn auth_rules(
        &mut self,
        auth_rules: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.auth_rules = Some(auth_rules);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn authorization_data(&mut self, authorization_data: AuthorizationDataLocal) -> &mut Self {
        self.instruction.authorization_data = Some(authorization_data);
        self
    }
    #[inline(always)]
    pub fn rules_acc_present(&mut self, rules_acc_present: bool) -> &mut Self {
        self.instruction.rules_acc_present = Some(rules_acc_present);
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
        let args = WithdrawNftInstructionArgs {
            authorization_data: self.instruction.authorization_data.clone(),
            rules_acc_present: self
                .instruction
                .rules_acc_present
                .clone()
                .expect("rules_acc_present is not set"),
        };
        let instruction = WithdrawNftCpi {
            __program: self.instruction.__program,

            owner: self.instruction.owner.expect("owner is not set"),

            pool: self.instruction.pool.expect("pool is not set"),

            mint: self.instruction.mint.expect("mint is not set"),

            owner_ata: self.instruction.owner_ata.expect("owner_ata is not set"),

            pool_ata: self.instruction.pool_ata.expect("pool_ata is not set"),

            nft_receipt: self
                .instruction
                .nft_receipt
                .expect("nft_receipt is not set"),

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

            metadata: self.instruction.metadata.expect("metadata is not set"),

            edition: self.instruction.edition.expect("edition is not set"),

            owner_token_record: self
                .instruction
                .owner_token_record
                .expect("owner_token_record is not set"),

            pool_token_record: self
                .instruction
                .pool_token_record
                .expect("pool_token_record is not set"),

            token_metadata_program: self
                .instruction
                .token_metadata_program
                .expect("token_metadata_program is not set"),

            instructions: self
                .instruction
                .instructions
                .expect("instructions is not set"),

            authorization_rules_program: self
                .instruction
                .authorization_rules_program
                .expect("authorization_rules_program is not set"),

            auth_rules: self.instruction.auth_rules.expect("auth_rules is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct WithdrawNftCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_receipt: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    metadata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    edition: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner_token_record: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool_token_record: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_metadata_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    instructions: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    authorization_rules_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    auth_rules: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    authorization_data: Option<AuthorizationDataLocal>,
    rules_acc_present: Option<bool>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
