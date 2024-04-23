//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::PoolConfig;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct SellNftTokenPoolT22 {
    pub owner: solana_program::pubkey::Pubkey,

    pub seller: solana_program::pubkey::Pubkey,

    pub fee_vault: solana_program::pubkey::Pubkey,

    pub pool: solana_program::pubkey::Pubkey,
    /// Needed for pool seeds derivation, also checked via has_one on pool
    pub whitelist: solana_program::pubkey::Pubkey,

    pub mint_proof: solana_program::pubkey::Pubkey,
    /// The mint account of the NFT being sold.
    pub mint: solana_program::pubkey::Pubkey,
    /// The ATA of the NFT for the seller's wallet.
    pub seller_ata: solana_program::pubkey::Pubkey,
    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    pub owner_ata: solana_program::pubkey::Pubkey,

    pub token_program: solana_program::pubkey::Pubkey,

    pub associated_token_program: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,

    pub shared_escrow_account: solana_program::pubkey::Pubkey,

    pub taker_broker: solana_program::pubkey::Pubkey,

    pub maker_broker: Option<solana_program::pubkey::Pubkey>,

    pub amm_program: solana_program::pubkey::Pubkey,
}

impl SellNftTokenPoolT22 {
    pub fn instruction(
        &self,
        args: SellNftTokenPoolT22InstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: SellNftTokenPoolT22InstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(16 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.seller,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.fee_vault,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.whitelist,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mint_proof,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mint, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.seller_ata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner_ata,
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
            self.shared_escrow_account,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.taker_broker,
            false,
        ));
        if let Some(maker_broker) = self.maker_broker {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                maker_broker,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.amm_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = SellNftTokenPoolT22InstructionData::new()
            .try_to_vec()
            .unwrap();
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
struct SellNftTokenPoolT22InstructionData {
    discriminator: [u8; 8],
}

impl SellNftTokenPoolT22InstructionData {
    fn new() -> Self {
        Self {
            discriminator: [149, 234, 31, 103, 26, 36, 166, 49],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SellNftTokenPoolT22InstructionArgs {
    pub config: PoolConfig,
    pub min_price: u64,
}

/// Instruction builder for `SellNftTokenPoolT22`.
///
/// ### Accounts:
///
///   0. `[writable]` owner
///   1. `[writable, signer]` seller
///   2. `[writable]` fee_vault
///   3. `[writable]` pool
///   4. `[]` whitelist
///   5. `[]` mint_proof
///   6. `[]` mint
///   7. `[writable]` seller_ata
///   8. `[writable]` owner_ata
///   9. `[optional]` token_program (default to `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
///   10. `[]` associated_token_program
///   11. `[optional]` system_program (default to `11111111111111111111111111111111`)
///   12. `[writable]` shared_escrow_account
///   13. `[writable]` taker_broker
///   14. `[optional]` maker_broker
///   15. `[]` amm_program
#[derive(Default)]
pub struct SellNftTokenPoolT22Builder {
    owner: Option<solana_program::pubkey::Pubkey>,
    seller: Option<solana_program::pubkey::Pubkey>,
    fee_vault: Option<solana_program::pubkey::Pubkey>,
    pool: Option<solana_program::pubkey::Pubkey>,
    whitelist: Option<solana_program::pubkey::Pubkey>,
    mint_proof: Option<solana_program::pubkey::Pubkey>,
    mint: Option<solana_program::pubkey::Pubkey>,
    seller_ata: Option<solana_program::pubkey::Pubkey>,
    owner_ata: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    shared_escrow_account: Option<solana_program::pubkey::Pubkey>,
    taker_broker: Option<solana_program::pubkey::Pubkey>,
    maker_broker: Option<solana_program::pubkey::Pubkey>,
    amm_program: Option<solana_program::pubkey::Pubkey>,
    config: Option<PoolConfig>,
    min_price: Option<u64>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl SellNftTokenPoolT22Builder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    #[inline(always)]
    pub fn seller(&mut self, seller: solana_program::pubkey::Pubkey) -> &mut Self {
        self.seller = Some(seller);
        self
    }
    #[inline(always)]
    pub fn fee_vault(&mut self, fee_vault: solana_program::pubkey::Pubkey) -> &mut Self {
        self.fee_vault = Some(fee_vault);
        self
    }
    #[inline(always)]
    pub fn pool(&mut self, pool: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool = Some(pool);
        self
    }
    /// Needed for pool seeds derivation, also checked via has_one on pool
    #[inline(always)]
    pub fn whitelist(&mut self, whitelist: solana_program::pubkey::Pubkey) -> &mut Self {
        self.whitelist = Some(whitelist);
        self
    }
    #[inline(always)]
    pub fn mint_proof(&mut self, mint_proof: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint_proof = Some(mint_proof);
        self
    }
    /// The mint account of the NFT being sold.
    #[inline(always)]
    pub fn mint(&mut self, mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint = Some(mint);
        self
    }
    /// The ATA of the NFT for the seller's wallet.
    #[inline(always)]
    pub fn seller_ata(&mut self, seller_ata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.seller_ata = Some(seller_ata);
        self
    }
    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    #[inline(always)]
    pub fn owner_ata(&mut self, owner_ata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner_ata = Some(owner_ata);
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
    pub fn shared_escrow_account(
        &mut self,
        shared_escrow_account: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.shared_escrow_account = Some(shared_escrow_account);
        self
    }
    #[inline(always)]
    pub fn taker_broker(&mut self, taker_broker: solana_program::pubkey::Pubkey) -> &mut Self {
        self.taker_broker = Some(taker_broker);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn maker_broker(
        &mut self,
        maker_broker: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.maker_broker = maker_broker;
        self
    }
    #[inline(always)]
    pub fn amm_program(&mut self, amm_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.amm_program = Some(amm_program);
        self
    }
    #[inline(always)]
    pub fn config(&mut self, config: PoolConfig) -> &mut Self {
        self.config = Some(config);
        self
    }
    #[inline(always)]
    pub fn min_price(&mut self, min_price: u64) -> &mut Self {
        self.min_price = Some(min_price);
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
        let accounts = SellNftTokenPoolT22 {
            owner: self.owner.expect("owner is not set"),
            seller: self.seller.expect("seller is not set"),
            fee_vault: self.fee_vault.expect("fee_vault is not set"),
            pool: self.pool.expect("pool is not set"),
            whitelist: self.whitelist.expect("whitelist is not set"),
            mint_proof: self.mint_proof.expect("mint_proof is not set"),
            mint: self.mint.expect("mint is not set"),
            seller_ata: self.seller_ata.expect("seller_ata is not set"),
            owner_ata: self.owner_ata.expect("owner_ata is not set"),
            token_program: self.token_program.unwrap_or(solana_program::pubkey!(
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            )),
            associated_token_program: self
                .associated_token_program
                .expect("associated_token_program is not set"),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
            shared_escrow_account: self
                .shared_escrow_account
                .expect("shared_escrow_account is not set"),
            taker_broker: self.taker_broker.expect("taker_broker is not set"),
            maker_broker: self.maker_broker,
            amm_program: self.amm_program.expect("amm_program is not set"),
        };
        let args = SellNftTokenPoolT22InstructionArgs {
            config: self.config.clone().expect("config is not set"),
            min_price: self.min_price.clone().expect("min_price is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `sell_nft_token_pool_t22` CPI accounts.
pub struct SellNftTokenPoolT22CpiAccounts<'a, 'b> {
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub seller: &'b solana_program::account_info::AccountInfo<'a>,

    pub fee_vault: &'b solana_program::account_info::AccountInfo<'a>,

    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// Needed for pool seeds derivation, also checked via has_one on pool
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint_proof: &'b solana_program::account_info::AccountInfo<'a>,
    /// The mint account of the NFT being sold.
    pub mint: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the NFT for the seller's wallet.
    pub seller_ata: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    pub owner_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow_account: &'b solana_program::account_info::AccountInfo<'a>,

    pub taker_broker: &'b solana_program::account_info::AccountInfo<'a>,

    pub maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub amm_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `sell_nft_token_pool_t22` CPI instruction.
pub struct SellNftTokenPoolT22Cpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub seller: &'b solana_program::account_info::AccountInfo<'a>,

    pub fee_vault: &'b solana_program::account_info::AccountInfo<'a>,

    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// Needed for pool seeds derivation, also checked via has_one on pool
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint_proof: &'b solana_program::account_info::AccountInfo<'a>,
    /// The mint account of the NFT being sold.
    pub mint: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the NFT for the seller's wallet.
    pub seller_ata: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    pub owner_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow_account: &'b solana_program::account_info::AccountInfo<'a>,

    pub taker_broker: &'b solana_program::account_info::AccountInfo<'a>,

    pub maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub amm_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: SellNftTokenPoolT22InstructionArgs,
}

impl<'a, 'b> SellNftTokenPoolT22Cpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: SellNftTokenPoolT22CpiAccounts<'a, 'b>,
        args: SellNftTokenPoolT22InstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            owner: accounts.owner,
            seller: accounts.seller,
            fee_vault: accounts.fee_vault,
            pool: accounts.pool,
            whitelist: accounts.whitelist,
            mint_proof: accounts.mint_proof,
            mint: accounts.mint,
            seller_ata: accounts.seller_ata,
            owner_ata: accounts.owner_ata,
            token_program: accounts.token_program,
            associated_token_program: accounts.associated_token_program,
            system_program: accounts.system_program,
            shared_escrow_account: accounts.shared_escrow_account,
            taker_broker: accounts.taker_broker,
            maker_broker: accounts.maker_broker,
            amm_program: accounts.amm_program,
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
        let mut accounts = Vec::with_capacity(16 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.seller.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.fee_vault.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.whitelist.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mint_proof.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.seller_ata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.owner_ata.key,
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
            *self.shared_escrow_account.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.taker_broker.key,
            false,
        ));
        if let Some(maker_broker) = self.maker_broker {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *maker_broker.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.amm_program.key,
            false,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = SellNftTokenPoolT22InstructionData::new()
            .try_to_vec()
            .unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(16 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.seller.clone());
        account_infos.push(self.fee_vault.clone());
        account_infos.push(self.pool.clone());
        account_infos.push(self.whitelist.clone());
        account_infos.push(self.mint_proof.clone());
        account_infos.push(self.mint.clone());
        account_infos.push(self.seller_ata.clone());
        account_infos.push(self.owner_ata.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
        account_infos.push(self.system_program.clone());
        account_infos.push(self.shared_escrow_account.clone());
        account_infos.push(self.taker_broker.clone());
        if let Some(maker_broker) = self.maker_broker {
            account_infos.push(maker_broker.clone());
        }
        account_infos.push(self.amm_program.clone());
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

/// Instruction builder for `SellNftTokenPoolT22` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` owner
///   1. `[writable, signer]` seller
///   2. `[writable]` fee_vault
///   3. `[writable]` pool
///   4. `[]` whitelist
///   5. `[]` mint_proof
///   6. `[]` mint
///   7. `[writable]` seller_ata
///   8. `[writable]` owner_ata
///   9. `[]` token_program
///   10. `[]` associated_token_program
///   11. `[]` system_program
///   12. `[writable]` shared_escrow_account
///   13. `[writable]` taker_broker
///   14. `[optional]` maker_broker
///   15. `[]` amm_program
pub struct SellNftTokenPoolT22CpiBuilder<'a, 'b> {
    instruction: Box<SellNftTokenPoolT22CpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> SellNftTokenPoolT22CpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(SellNftTokenPoolT22CpiBuilderInstruction {
            __program: program,
            owner: None,
            seller: None,
            fee_vault: None,
            pool: None,
            whitelist: None,
            mint_proof: None,
            mint: None,
            seller_ata: None,
            owner_ata: None,
            token_program: None,
            associated_token_program: None,
            system_program: None,
            shared_escrow_account: None,
            taker_broker: None,
            maker_broker: None,
            amm_program: None,
            config: None,
            min_price: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    #[inline(always)]
    pub fn seller(
        &mut self,
        seller: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.seller = Some(seller);
        self
    }
    #[inline(always)]
    pub fn fee_vault(
        &mut self,
        fee_vault: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.fee_vault = Some(fee_vault);
        self
    }
    #[inline(always)]
    pub fn pool(&mut self, pool: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.pool = Some(pool);
        self
    }
    /// Needed for pool seeds derivation, also checked via has_one on pool
    #[inline(always)]
    pub fn whitelist(
        &mut self,
        whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.whitelist = Some(whitelist);
        self
    }
    #[inline(always)]
    pub fn mint_proof(
        &mut self,
        mint_proof: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.mint_proof = Some(mint_proof);
        self
    }
    /// The mint account of the NFT being sold.
    #[inline(always)]
    pub fn mint(&mut self, mint: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.mint = Some(mint);
        self
    }
    /// The ATA of the NFT for the seller's wallet.
    #[inline(always)]
    pub fn seller_ata(
        &mut self,
        seller_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.seller_ata = Some(seller_ata);
        self
    }
    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    #[inline(always)]
    pub fn owner_ata(
        &mut self,
        owner_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.owner_ata = Some(owner_ata);
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
    pub fn shared_escrow_account(
        &mut self,
        shared_escrow_account: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.shared_escrow_account = Some(shared_escrow_account);
        self
    }
    #[inline(always)]
    pub fn taker_broker(
        &mut self,
        taker_broker: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.taker_broker = Some(taker_broker);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn maker_broker(
        &mut self,
        maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.maker_broker = maker_broker;
        self
    }
    #[inline(always)]
    pub fn amm_program(
        &mut self,
        amm_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.amm_program = Some(amm_program);
        self
    }
    #[inline(always)]
    pub fn config(&mut self, config: PoolConfig) -> &mut Self {
        self.instruction.config = Some(config);
        self
    }
    #[inline(always)]
    pub fn min_price(&mut self, min_price: u64) -> &mut Self {
        self.instruction.min_price = Some(min_price);
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
        let args = SellNftTokenPoolT22InstructionArgs {
            config: self.instruction.config.clone().expect("config is not set"),
            min_price: self
                .instruction
                .min_price
                .clone()
                .expect("min_price is not set"),
        };
        let instruction = SellNftTokenPoolT22Cpi {
            __program: self.instruction.__program,

            owner: self.instruction.owner.expect("owner is not set"),

            seller: self.instruction.seller.expect("seller is not set"),

            fee_vault: self.instruction.fee_vault.expect("fee_vault is not set"),

            pool: self.instruction.pool.expect("pool is not set"),

            whitelist: self.instruction.whitelist.expect("whitelist is not set"),

            mint_proof: self.instruction.mint_proof.expect("mint_proof is not set"),

            mint: self.instruction.mint.expect("mint is not set"),

            seller_ata: self.instruction.seller_ata.expect("seller_ata is not set"),

            owner_ata: self.instruction.owner_ata.expect("owner_ata is not set"),

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

            shared_escrow_account: self
                .instruction
                .shared_escrow_account
                .expect("shared_escrow_account is not set"),

            taker_broker: self
                .instruction
                .taker_broker
                .expect("taker_broker is not set"),

            maker_broker: self.instruction.maker_broker,

            amm_program: self
                .instruction
                .amm_program
                .expect("amm_program is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct SellNftTokenPoolT22CpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    seller: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    fee_vault: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    seller_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    shared_escrow_account: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    taker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    amm_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    config: Option<PoolConfig>,
    min_price: Option<u64>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
