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
pub struct BuyNftT22 {
    pub owner: solana_program::pubkey::Pubkey,

    pub buyer: solana_program::pubkey::Pubkey,

    pub fee_vault: solana_program::pubkey::Pubkey,

    pub pool: solana_program::pubkey::Pubkey,
    /// Needed for pool seeds derivation, has_one = whitelist on pool
    pub whitelist: solana_program::pubkey::Pubkey,
    /// The ATA of the buyer, where the NFT will be transferred.
    pub buyer_ata: solana_program::pubkey::Pubkey,
    /// The ATA of the pool, where the NFT will be escrowed.
    pub pool_ata: solana_program::pubkey::Pubkey,

    pub mint: solana_program::pubkey::Pubkey,

    pub nft_receipt: solana_program::pubkey::Pubkey,

    pub token_program: solana_program::pubkey::Pubkey,

    pub associated_token_program: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,

    pub shared_escrow_account: solana_program::pubkey::Pubkey,

    pub taker_broker: solana_program::pubkey::Pubkey,

    pub maker_broker: Option<solana_program::pubkey::Pubkey>,
}

impl BuyNftT22 {
    pub fn instruction(
        &self,
        args: BuyNftT22InstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: BuyNftT22InstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(15 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.buyer, true,
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.buyer_ata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.pool_ata,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mint, false,
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
        accounts.extend_from_slice(remaining_accounts);
        let mut data = BuyNftT22InstructionData::new().try_to_vec().unwrap();
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
struct BuyNftT22InstructionData {
    discriminator: [u8; 8],
}

impl BuyNftT22InstructionData {
    fn new() -> Self {
        Self {
            discriminator: [155, 219, 126, 245, 170, 199, 51, 79],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct BuyNftT22InstructionArgs {
    pub config: PoolConfig,
    pub max_price: u64,
}

/// Instruction builder for `BuyNftT22`.
///
/// ### Accounts:
///
///   0. `[writable]` owner
///   1. `[writable, signer]` buyer
///   2. `[writable]` fee_vault
///   3. `[writable]` pool
///   4. `[]` whitelist
///   5. `[writable]` buyer_ata
///   6. `[]` pool_ata
///   7. `[]` mint
///   8. `[writable]` nft_receipt
///   9. `[optional]` token_program (default to `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
///   10. `[]` associated_token_program
///   11. `[optional]` system_program (default to `11111111111111111111111111111111`)
///   12. `[writable]` shared_escrow_account
///   13. `[writable]` taker_broker
///   14. `[optional]` maker_broker
#[derive(Default)]
pub struct BuyNftT22Builder {
    owner: Option<solana_program::pubkey::Pubkey>,
    buyer: Option<solana_program::pubkey::Pubkey>,
    fee_vault: Option<solana_program::pubkey::Pubkey>,
    pool: Option<solana_program::pubkey::Pubkey>,
    whitelist: Option<solana_program::pubkey::Pubkey>,
    buyer_ata: Option<solana_program::pubkey::Pubkey>,
    pool_ata: Option<solana_program::pubkey::Pubkey>,
    mint: Option<solana_program::pubkey::Pubkey>,
    nft_receipt: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    shared_escrow_account: Option<solana_program::pubkey::Pubkey>,
    taker_broker: Option<solana_program::pubkey::Pubkey>,
    maker_broker: Option<solana_program::pubkey::Pubkey>,
    config: Option<PoolConfig>,
    max_price: Option<u64>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl BuyNftT22Builder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    #[inline(always)]
    pub fn buyer(&mut self, buyer: solana_program::pubkey::Pubkey) -> &mut Self {
        self.buyer = Some(buyer);
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
    /// Needed for pool seeds derivation, has_one = whitelist on pool
    #[inline(always)]
    pub fn whitelist(&mut self, whitelist: solana_program::pubkey::Pubkey) -> &mut Self {
        self.whitelist = Some(whitelist);
        self
    }
    /// The ATA of the buyer, where the NFT will be transferred.
    #[inline(always)]
    pub fn buyer_ata(&mut self, buyer_ata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.buyer_ata = Some(buyer_ata);
        self
    }
    /// The ATA of the pool, where the NFT will be escrowed.
    #[inline(always)]
    pub fn pool_ata(&mut self, pool_ata: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool_ata = Some(pool_ata);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint = Some(mint);
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
    pub fn config(&mut self, config: PoolConfig) -> &mut Self {
        self.config = Some(config);
        self
    }
    #[inline(always)]
    pub fn max_price(&mut self, max_price: u64) -> &mut Self {
        self.max_price = Some(max_price);
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
        let accounts = BuyNftT22 {
            owner: self.owner.expect("owner is not set"),
            buyer: self.buyer.expect("buyer is not set"),
            fee_vault: self.fee_vault.expect("fee_vault is not set"),
            pool: self.pool.expect("pool is not set"),
            whitelist: self.whitelist.expect("whitelist is not set"),
            buyer_ata: self.buyer_ata.expect("buyer_ata is not set"),
            pool_ata: self.pool_ata.expect("pool_ata is not set"),
            mint: self.mint.expect("mint is not set"),
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
            shared_escrow_account: self
                .shared_escrow_account
                .expect("shared_escrow_account is not set"),
            taker_broker: self.taker_broker.expect("taker_broker is not set"),
            maker_broker: self.maker_broker,
        };
        let args = BuyNftT22InstructionArgs {
            config: self.config.clone().expect("config is not set"),
            max_price: self.max_price.clone().expect("max_price is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `buy_nft_t22` CPI accounts.
pub struct BuyNftT22CpiAccounts<'a, 'b> {
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub buyer: &'b solana_program::account_info::AccountInfo<'a>,

    pub fee_vault: &'b solana_program::account_info::AccountInfo<'a>,

    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// Needed for pool seeds derivation, has_one = whitelist on pool
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the buyer, where the NFT will be transferred.
    pub buyer_ata: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the pool, where the NFT will be escrowed.
    pub pool_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow_account: &'b solana_program::account_info::AccountInfo<'a>,

    pub taker_broker: &'b solana_program::account_info::AccountInfo<'a>,

    pub maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
}

/// `buy_nft_t22` CPI instruction.
pub struct BuyNftT22Cpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub buyer: &'b solana_program::account_info::AccountInfo<'a>,

    pub fee_vault: &'b solana_program::account_info::AccountInfo<'a>,

    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// Needed for pool seeds derivation, has_one = whitelist on pool
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the buyer, where the NFT will be transferred.
    pub buyer_ata: &'b solana_program::account_info::AccountInfo<'a>,
    /// The ATA of the pool, where the NFT will be escrowed.
    pub pool_ata: &'b solana_program::account_info::AccountInfo<'a>,

    pub mint: &'b solana_program::account_info::AccountInfo<'a>,

    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow_account: &'b solana_program::account_info::AccountInfo<'a>,

    pub taker_broker: &'b solana_program::account_info::AccountInfo<'a>,

    pub maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The arguments for the instruction.
    pub __args: BuyNftT22InstructionArgs,
}

impl<'a, 'b> BuyNftT22Cpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: BuyNftT22CpiAccounts<'a, 'b>,
        args: BuyNftT22InstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            owner: accounts.owner,
            buyer: accounts.buyer,
            fee_vault: accounts.fee_vault,
            pool: accounts.pool,
            whitelist: accounts.whitelist,
            buyer_ata: accounts.buyer_ata,
            pool_ata: accounts.pool_ata,
            mint: accounts.mint,
            nft_receipt: accounts.nft_receipt,
            token_program: accounts.token_program,
            associated_token_program: accounts.associated_token_program,
            system_program: accounts.system_program,
            shared_escrow_account: accounts.shared_escrow_account,
            taker_broker: accounts.taker_broker,
            maker_broker: accounts.maker_broker,
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
            *self.owner.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.buyer.key,
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.buyer_ata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.pool_ata.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mint.key,
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
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = BuyNftT22InstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(15 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.buyer.clone());
        account_infos.push(self.fee_vault.clone());
        account_infos.push(self.pool.clone());
        account_infos.push(self.whitelist.clone());
        account_infos.push(self.buyer_ata.clone());
        account_infos.push(self.pool_ata.clone());
        account_infos.push(self.mint.clone());
        account_infos.push(self.nft_receipt.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
        account_infos.push(self.system_program.clone());
        account_infos.push(self.shared_escrow_account.clone());
        account_infos.push(self.taker_broker.clone());
        if let Some(maker_broker) = self.maker_broker {
            account_infos.push(maker_broker.clone());
        }
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

/// Instruction builder for `BuyNftT22` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` owner
///   1. `[writable, signer]` buyer
///   2. `[writable]` fee_vault
///   3. `[writable]` pool
///   4. `[]` whitelist
///   5. `[writable]` buyer_ata
///   6. `[]` pool_ata
///   7. `[]` mint
///   8. `[writable]` nft_receipt
///   9. `[]` token_program
///   10. `[]` associated_token_program
///   11. `[]` system_program
///   12. `[writable]` shared_escrow_account
///   13. `[writable]` taker_broker
///   14. `[optional]` maker_broker
pub struct BuyNftT22CpiBuilder<'a, 'b> {
    instruction: Box<BuyNftT22CpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> BuyNftT22CpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(BuyNftT22CpiBuilderInstruction {
            __program: program,
            owner: None,
            buyer: None,
            fee_vault: None,
            pool: None,
            whitelist: None,
            buyer_ata: None,
            pool_ata: None,
            mint: None,
            nft_receipt: None,
            token_program: None,
            associated_token_program: None,
            system_program: None,
            shared_escrow_account: None,
            taker_broker: None,
            maker_broker: None,
            config: None,
            max_price: None,
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
    pub fn buyer(&mut self, buyer: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.buyer = Some(buyer);
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
    /// Needed for pool seeds derivation, has_one = whitelist on pool
    #[inline(always)]
    pub fn whitelist(
        &mut self,
        whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.whitelist = Some(whitelist);
        self
    }
    /// The ATA of the buyer, where the NFT will be transferred.
    #[inline(always)]
    pub fn buyer_ata(
        &mut self,
        buyer_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.buyer_ata = Some(buyer_ata);
        self
    }
    /// The ATA of the pool, where the NFT will be escrowed.
    #[inline(always)]
    pub fn pool_ata(
        &mut self,
        pool_ata: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.pool_ata = Some(pool_ata);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.mint = Some(mint);
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
    pub fn config(&mut self, config: PoolConfig) -> &mut Self {
        self.instruction.config = Some(config);
        self
    }
    #[inline(always)]
    pub fn max_price(&mut self, max_price: u64) -> &mut Self {
        self.instruction.max_price = Some(max_price);
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
        let args = BuyNftT22InstructionArgs {
            config: self.instruction.config.clone().expect("config is not set"),
            max_price: self
                .instruction
                .max_price
                .clone()
                .expect("max_price is not set"),
        };
        let instruction = BuyNftT22Cpi {
            __program: self.instruction.__program,

            owner: self.instruction.owner.expect("owner is not set"),

            buyer: self.instruction.buyer.expect("buyer is not set"),

            fee_vault: self.instruction.fee_vault.expect("fee_vault is not set"),

            pool: self.instruction.pool.expect("pool is not set"),

            whitelist: self.instruction.whitelist.expect("whitelist is not set"),

            buyer_ata: self.instruction.buyer_ata.expect("buyer_ata is not set"),

            pool_ata: self.instruction.pool_ata.expect("pool_ata is not set"),

            mint: self.instruction.mint.expect("mint is not set"),

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

            shared_escrow_account: self
                .instruction
                .shared_escrow_account
                .expect("shared_escrow_account is not set"),

            taker_broker: self
                .instruction
                .taker_broker
                .expect("taker_broker is not set"),

            maker_broker: self.instruction.maker_broker,
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct BuyNftT22CpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    buyer: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    fee_vault: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    buyer_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool_ata: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_receipt: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    shared_escrow_account: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    taker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    maker_broker: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    config: Option<PoolConfig>,
    max_price: Option<u64>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
