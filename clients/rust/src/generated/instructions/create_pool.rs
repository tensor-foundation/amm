//! This code was AUTOGENERATED using the codama library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun codama to update it.
//!
//! <https://github.com/codama-idl/codama>
//!

use crate::generated::types::PoolConfig;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

/// Accounts.
pub struct CreatePool {
    /// The account that pays for the rent to open the pool. This will be stored on the pool
    /// so it can be refunded when the pool is closed.
    pub rent_payer: solana_program::pubkey::Pubkey,
    /// The owner of the pool will be stored and used to control permissioned pool instructions.
    pub owner: solana_program::pubkey::Pubkey,
    /// The pool state account.
    pub pool: solana_program::pubkey::Pubkey,
    /// The whitelist that gatekeeps which NFTs can be bought or sold with this pool.
    pub whitelist: solana_program::pubkey::Pubkey,

    pub shared_escrow: Option<solana_program::pubkey::Pubkey>,
    /// The Solana system program.
    pub system_program: solana_program::pubkey::Pubkey,
}

impl CreatePool {
    pub fn instruction(
        &self,
        args: CreatePoolInstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: CreatePoolInstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(6 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.rent_payer,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.owner, true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.whitelist,
            false,
        ));
        if let Some(shared_escrow) = self.shared_escrow {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                shared_escrow,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = CreatePoolInstructionData::new().try_to_vec().unwrap();
        let mut args = args.try_to_vec().unwrap();
        data.append(&mut args);

        solana_program::instruction::Instruction {
            program_id: crate::TENSOR_AMM_ID,
            accounts,
            data,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct CreatePoolInstructionData {
    discriminator: [u8; 8],
}

impl CreatePoolInstructionData {
    pub fn new() -> Self {
        Self {
            discriminator: [233, 146, 209, 142, 207, 104, 64, 188],
        }
    }
}

impl Default for CreatePoolInstructionData {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CreatePoolInstructionArgs {
    pub pool_id: [u8; 32],
    pub config: PoolConfig,
    pub currency: Option<Pubkey>,
    pub cosigner: Option<Pubkey>,
    pub maker_broker: Option<Pubkey>,
    pub max_taker_sell_count: Option<u32>,
    pub expire_in_sec: Option<u64>,
}

/// Instruction builder for `CreatePool`.
///
/// ### Accounts:
///
///   0. `[writable, signer]` rent_payer
///   1. `[signer]` owner
///   2. `[writable]` pool
///   3. `[]` whitelist
///   4. `[optional]` shared_escrow
///   5. `[optional]` system_program (default to `11111111111111111111111111111111`)
#[derive(Clone, Debug, Default)]
pub struct CreatePoolBuilder {
    rent_payer: Option<solana_program::pubkey::Pubkey>,
    owner: Option<solana_program::pubkey::Pubkey>,
    pool: Option<solana_program::pubkey::Pubkey>,
    whitelist: Option<solana_program::pubkey::Pubkey>,
    shared_escrow: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    pool_id: Option<[u8; 32]>,
    config: Option<PoolConfig>,
    currency: Option<Pubkey>,
    cosigner: Option<Pubkey>,
    maker_broker: Option<Pubkey>,
    max_taker_sell_count: Option<u32>,
    expire_in_sec: Option<u64>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl CreatePoolBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    /// The account that pays for the rent to open the pool. This will be stored on the pool
    /// so it can be refunded when the pool is closed.
    #[inline(always)]
    pub fn rent_payer(&mut self, rent_payer: solana_program::pubkey::Pubkey) -> &mut Self {
        self.rent_payer = Some(rent_payer);
        self
    }
    /// The owner of the pool will be stored and used to control permissioned pool instructions.
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    /// The pool state account.
    #[inline(always)]
    pub fn pool(&mut self, pool: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool = Some(pool);
        self
    }
    /// The whitelist that gatekeeps which NFTs can be bought or sold with this pool.
    #[inline(always)]
    pub fn whitelist(&mut self, whitelist: solana_program::pubkey::Pubkey) -> &mut Self {
        self.whitelist = Some(whitelist);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn shared_escrow(
        &mut self,
        shared_escrow: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.shared_escrow = shared_escrow;
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    /// The Solana system program.
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn pool_id(&mut self, pool_id: [u8; 32]) -> &mut Self {
        self.pool_id = Some(pool_id);
        self
    }
    #[inline(always)]
    pub fn config(&mut self, config: PoolConfig) -> &mut Self {
        self.config = Some(config);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn currency(&mut self, currency: Pubkey) -> &mut Self {
        self.currency = Some(currency);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn cosigner(&mut self, cosigner: Pubkey) -> &mut Self {
        self.cosigner = Some(cosigner);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn maker_broker(&mut self, maker_broker: Pubkey) -> &mut Self {
        self.maker_broker = Some(maker_broker);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn max_taker_sell_count(&mut self, max_taker_sell_count: u32) -> &mut Self {
        self.max_taker_sell_count = Some(max_taker_sell_count);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn expire_in_sec(&mut self, expire_in_sec: u64) -> &mut Self {
        self.expire_in_sec = Some(expire_in_sec);
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
        let accounts = CreatePool {
            rent_payer: self.rent_payer.expect("rent_payer is not set"),
            owner: self.owner.expect("owner is not set"),
            pool: self.pool.expect("pool is not set"),
            whitelist: self.whitelist.expect("whitelist is not set"),
            shared_escrow: self.shared_escrow,
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
        };
        let args = CreatePoolInstructionArgs {
            pool_id: self.pool_id.clone().expect("pool_id is not set"),
            config: self.config.clone().expect("config is not set"),
            currency: self.currency.clone(),
            cosigner: self.cosigner.clone(),
            maker_broker: self.maker_broker.clone(),
            max_taker_sell_count: self.max_taker_sell_count.clone(),
            expire_in_sec: self.expire_in_sec.clone(),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `create_pool` CPI accounts.
pub struct CreatePoolCpiAccounts<'a, 'b> {
    /// The account that pays for the rent to open the pool. This will be stored on the pool
    /// so it can be refunded when the pool is closed.
    pub rent_payer: &'b solana_program::account_info::AccountInfo<'a>,
    /// The owner of the pool will be stored and used to control permissioned pool instructions.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool state account.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// The whitelist that gatekeeps which NFTs can be bought or sold with this pool.
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The Solana system program.
    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `create_pool` CPI instruction.
pub struct CreatePoolCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The account that pays for the rent to open the pool. This will be stored on the pool
    /// so it can be refunded when the pool is closed.
    pub rent_payer: &'b solana_program::account_info::AccountInfo<'a>,
    /// The owner of the pool will be stored and used to control permissioned pool instructions.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool state account.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// The whitelist that gatekeeps which NFTs can be bought or sold with this pool.
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The Solana system program.
    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: CreatePoolInstructionArgs,
}

impl<'a, 'b> CreatePoolCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: CreatePoolCpiAccounts<'a, 'b>,
        args: CreatePoolInstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            rent_payer: accounts.rent_payer,
            owner: accounts.owner,
            pool: accounts.pool,
            whitelist: accounts.whitelist,
            shared_escrow: accounts.shared_escrow,
            system_program: accounts.system_program,
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
        let mut accounts = Vec::with_capacity(6 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.rent_payer.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.owner.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.pool.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.whitelist.key,
            false,
        ));
        if let Some(shared_escrow) = self.shared_escrow {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *shared_escrow.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
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
        let mut data = CreatePoolInstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::TENSOR_AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(7 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.rent_payer.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.pool.clone());
        account_infos.push(self.whitelist.clone());
        if let Some(shared_escrow) = self.shared_escrow {
            account_infos.push(shared_escrow.clone());
        }
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

/// Instruction builder for `CreatePool` via CPI.
///
/// ### Accounts:
///
///   0. `[writable, signer]` rent_payer
///   1. `[signer]` owner
///   2. `[writable]` pool
///   3. `[]` whitelist
///   4. `[optional]` shared_escrow
///   5. `[]` system_program
#[derive(Clone, Debug)]
pub struct CreatePoolCpiBuilder<'a, 'b> {
    instruction: Box<CreatePoolCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> CreatePoolCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(CreatePoolCpiBuilderInstruction {
            __program: program,
            rent_payer: None,
            owner: None,
            pool: None,
            whitelist: None,
            shared_escrow: None,
            system_program: None,
            pool_id: None,
            config: None,
            currency: None,
            cosigner: None,
            maker_broker: None,
            max_taker_sell_count: None,
            expire_in_sec: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    /// The account that pays for the rent to open the pool. This will be stored on the pool
    /// so it can be refunded when the pool is closed.
    #[inline(always)]
    pub fn rent_payer(
        &mut self,
        rent_payer: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.rent_payer = Some(rent_payer);
        self
    }
    /// The owner of the pool will be stored and used to control permissioned pool instructions.
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    /// The pool state account.
    #[inline(always)]
    pub fn pool(&mut self, pool: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.pool = Some(pool);
        self
    }
    /// The whitelist that gatekeeps which NFTs can be bought or sold with this pool.
    #[inline(always)]
    pub fn whitelist(
        &mut self,
        whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.whitelist = Some(whitelist);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn shared_escrow(
        &mut self,
        shared_escrow: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.shared_escrow = shared_escrow;
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
    #[inline(always)]
    pub fn pool_id(&mut self, pool_id: [u8; 32]) -> &mut Self {
        self.instruction.pool_id = Some(pool_id);
        self
    }
    #[inline(always)]
    pub fn config(&mut self, config: PoolConfig) -> &mut Self {
        self.instruction.config = Some(config);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn currency(&mut self, currency: Pubkey) -> &mut Self {
        self.instruction.currency = Some(currency);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn cosigner(&mut self, cosigner: Pubkey) -> &mut Self {
        self.instruction.cosigner = Some(cosigner);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn maker_broker(&mut self, maker_broker: Pubkey) -> &mut Self {
        self.instruction.maker_broker = Some(maker_broker);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn max_taker_sell_count(&mut self, max_taker_sell_count: u32) -> &mut Self {
        self.instruction.max_taker_sell_count = Some(max_taker_sell_count);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn expire_in_sec(&mut self, expire_in_sec: u64) -> &mut Self {
        self.instruction.expire_in_sec = Some(expire_in_sec);
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
        let args = CreatePoolInstructionArgs {
            pool_id: self
                .instruction
                .pool_id
                .clone()
                .expect("pool_id is not set"),
            config: self.instruction.config.clone().expect("config is not set"),
            currency: self.instruction.currency.clone(),
            cosigner: self.instruction.cosigner.clone(),
            maker_broker: self.instruction.maker_broker.clone(),
            max_taker_sell_count: self.instruction.max_taker_sell_count.clone(),
            expire_in_sec: self.instruction.expire_in_sec.clone(),
        };
        let instruction = CreatePoolCpi {
            __program: self.instruction.__program,

            rent_payer: self.instruction.rent_payer.expect("rent_payer is not set"),

            owner: self.instruction.owner.expect("owner is not set"),

            pool: self.instruction.pool.expect("pool is not set"),

            whitelist: self.instruction.whitelist.expect("whitelist is not set"),

            shared_escrow: self.instruction.shared_escrow,

            system_program: self
                .instruction
                .system_program
                .expect("system_program is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

#[derive(Clone, Debug)]
struct CreatePoolCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    rent_payer: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    shared_escrow: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool_id: Option<[u8; 32]>,
    config: Option<PoolConfig>,
    currency: Option<Pubkey>,
    cosigner: Option<Pubkey>,
    maker_broker: Option<Pubkey>,
    max_taker_sell_count: Option<u32>,
    expire_in_sec: Option<u64>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
