//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct WithdrawSharedEscrowCpiTlock {
    pub shared_escrow: solana_program::pubkey::Pubkey,

    pub order_state: solana_program::pubkey::Pubkey,

    pub owner: solana_program::pubkey::Pubkey,

    pub destination: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,
}

impl WithdrawSharedEscrowCpiTlock {
    pub fn instruction(
        &self,
        args: WithdrawSharedEscrowCpiTlockInstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: WithdrawSharedEscrowCpiTlockInstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(5 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.shared_escrow,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.order_state,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.owner, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.destination,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = WithdrawSharedEscrowCpiTlockInstructionData::new()
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
struct WithdrawSharedEscrowCpiTlockInstructionData {
    discriminator: [u8; 8],
}

impl WithdrawSharedEscrowCpiTlockInstructionData {
    fn new() -> Self {
        Self {
            discriminator: [5, 242, 176, 14, 221, 3, 185, 71],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct WithdrawSharedEscrowCpiTlockInstructionArgs {
    pub bump: u8,
    pub order_id: [u8; 32],
    pub lamports: u64,
}

/// Instruction builder for `WithdrawSharedEscrowCpiTlock`.
///
/// ### Accounts:
///
///   0. `[writable]` shared_escrow
///   1. `[signer]` order_state
///   2. `[]` owner
///   3. `[writable]` destination
///   4. `[optional]` system_program (default to `11111111111111111111111111111111`)
#[derive(Default)]
pub struct WithdrawSharedEscrowCpiTlockBuilder {
    shared_escrow: Option<solana_program::pubkey::Pubkey>,
    order_state: Option<solana_program::pubkey::Pubkey>,
    owner: Option<solana_program::pubkey::Pubkey>,
    destination: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    bump: Option<u8>,
    order_id: Option<[u8; 32]>,
    lamports: Option<u64>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl WithdrawSharedEscrowCpiTlockBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn shared_escrow(&mut self, shared_escrow: solana_program::pubkey::Pubkey) -> &mut Self {
        self.shared_escrow = Some(shared_escrow);
        self
    }
    #[inline(always)]
    pub fn order_state(&mut self, order_state: solana_program::pubkey::Pubkey) -> &mut Self {
        self.order_state = Some(order_state);
        self
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    #[inline(always)]
    pub fn destination(&mut self, destination: solana_program::pubkey::Pubkey) -> &mut Self {
        self.destination = Some(destination);
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn bump(&mut self, bump: u8) -> &mut Self {
        self.bump = Some(bump);
        self
    }
    #[inline(always)]
    pub fn order_id(&mut self, order_id: [u8; 32]) -> &mut Self {
        self.order_id = Some(order_id);
        self
    }
    #[inline(always)]
    pub fn lamports(&mut self, lamports: u64) -> &mut Self {
        self.lamports = Some(lamports);
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
        let accounts = WithdrawSharedEscrowCpiTlock {
            shared_escrow: self.shared_escrow.expect("shared_escrow is not set"),
            order_state: self.order_state.expect("order_state is not set"),
            owner: self.owner.expect("owner is not set"),
            destination: self.destination.expect("destination is not set"),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
        };
        let args = WithdrawSharedEscrowCpiTlockInstructionArgs {
            bump: self.bump.clone().expect("bump is not set"),
            order_id: self.order_id.clone().expect("order_id is not set"),
            lamports: self.lamports.clone().expect("lamports is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `withdraw_shared_escrow_cpi_tlock` CPI accounts.
pub struct WithdrawSharedEscrowCpiTlockCpiAccounts<'a, 'b> {
    pub shared_escrow: &'b solana_program::account_info::AccountInfo<'a>,

    pub order_state: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub destination: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `withdraw_shared_escrow_cpi_tlock` CPI instruction.
pub struct WithdrawSharedEscrowCpiTlockCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub shared_escrow: &'b solana_program::account_info::AccountInfo<'a>,

    pub order_state: &'b solana_program::account_info::AccountInfo<'a>,

    pub owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub destination: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: WithdrawSharedEscrowCpiTlockInstructionArgs,
}

impl<'a, 'b> WithdrawSharedEscrowCpiTlockCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: WithdrawSharedEscrowCpiTlockCpiAccounts<'a, 'b>,
        args: WithdrawSharedEscrowCpiTlockInstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            shared_escrow: accounts.shared_escrow,
            order_state: accounts.order_state,
            owner: accounts.owner,
            destination: accounts.destination,
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
        let mut accounts = Vec::with_capacity(5 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.shared_escrow.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.order_state.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.owner.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.destination.key,
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
        let mut data = WithdrawSharedEscrowCpiTlockInstructionData::new()
            .try_to_vec()
            .unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(5 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.shared_escrow.clone());
        account_infos.push(self.order_state.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.destination.clone());
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

/// Instruction builder for `WithdrawSharedEscrowCpiTlock` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` shared_escrow
///   1. `[signer]` order_state
///   2. `[]` owner
///   3. `[writable]` destination
///   4. `[]` system_program
pub struct WithdrawSharedEscrowCpiTlockCpiBuilder<'a, 'b> {
    instruction: Box<WithdrawSharedEscrowCpiTlockCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> WithdrawSharedEscrowCpiTlockCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(WithdrawSharedEscrowCpiTlockCpiBuilderInstruction {
            __program: program,
            shared_escrow: None,
            order_state: None,
            owner: None,
            destination: None,
            system_program: None,
            bump: None,
            order_id: None,
            lamports: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn shared_escrow(
        &mut self,
        shared_escrow: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.shared_escrow = Some(shared_escrow);
        self
    }
    #[inline(always)]
    pub fn order_state(
        &mut self,
        order_state: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.order_state = Some(order_state);
        self
    }
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    #[inline(always)]
    pub fn destination(
        &mut self,
        destination: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.destination = Some(destination);
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
    pub fn bump(&mut self, bump: u8) -> &mut Self {
        self.instruction.bump = Some(bump);
        self
    }
    #[inline(always)]
    pub fn order_id(&mut self, order_id: [u8; 32]) -> &mut Self {
        self.instruction.order_id = Some(order_id);
        self
    }
    #[inline(always)]
    pub fn lamports(&mut self, lamports: u64) -> &mut Self {
        self.instruction.lamports = Some(lamports);
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
        let args = WithdrawSharedEscrowCpiTlockInstructionArgs {
            bump: self.instruction.bump.clone().expect("bump is not set"),
            order_id: self
                .instruction
                .order_id
                .clone()
                .expect("order_id is not set"),
            lamports: self
                .instruction
                .lamports
                .clone()
                .expect("lamports is not set"),
        };
        let instruction = WithdrawSharedEscrowCpiTlockCpi {
            __program: self.instruction.__program,

            shared_escrow: self
                .instruction
                .shared_escrow
                .expect("shared_escrow is not set"),

            order_state: self
                .instruction
                .order_state
                .expect("order_state is not set"),

            owner: self.instruction.owner.expect("owner is not set"),

            destination: self
                .instruction
                .destination
                .expect("destination is not set"),

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

struct WithdrawSharedEscrowCpiTlockCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    shared_escrow: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    order_state: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    destination: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    bump: Option<u8>,
    order_id: Option<[u8; 32]>,
    lamports: Option<u64>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}