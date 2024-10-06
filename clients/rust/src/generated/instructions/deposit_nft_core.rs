//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! <https://github.com/kinobi-so/kinobi>
//!

use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct DepositNftCore {
    /// The MPL core asset account.
    pub asset: solana_program::pubkey::Pubkey,

    pub collection: Option<solana_program::pubkey::Pubkey>,
    /// The MPL Core program.
    pub mpl_core_program: solana_program::pubkey::Pubkey,
    /// The owner of the pool and the NFT.
    pub owner: solana_program::pubkey::Pubkey,
    /// The pool the asset is being transferred to/from.
    pub pool: solana_program::pubkey::Pubkey,
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    pub whitelist: solana_program::pubkey::Pubkey,
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    pub mint_proof: Option<solana_program::pubkey::Pubkey>,
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    pub nft_receipt: solana_program::pubkey::Pubkey,
    /// The Solana system program.
    pub system_program: solana_program::pubkey::Pubkey,
}

impl DepositNftCore {
    pub fn instruction(&self) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(&[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(9 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.asset, false,
        ));
        if let Some(collection) = self.collection {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                collection, false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mpl_core_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.owner, true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.pool, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.whitelist,
            false,
        ));
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.nft_receipt,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let data = DepositNftCoreInstructionData::new().try_to_vec().unwrap();

        solana_program::instruction::Instruction {
            program_id: crate::TENSOR_AMM_ID,
            accounts,
            data,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct DepositNftCoreInstructionData {
    discriminator: [u8; 8],
}

impl DepositNftCoreInstructionData {
    pub fn new() -> Self {
        Self {
            discriminator: [73, 21, 4, 64, 161, 214, 248, 77],
        }
    }
}

impl Default for DepositNftCoreInstructionData {
    fn default() -> Self {
        Self::new()
    }
}

/// Instruction builder for `DepositNftCore`.
///
/// ### Accounts:
///
///   0. `[writable]` asset
///   1. `[optional]` collection
///   2. `[optional]` mpl_core_program (default to `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`)
///   3. `[writable, signer]` owner
///   4. `[writable]` pool
///   5. `[]` whitelist
///   6. `[optional]` mint_proof
///   7. `[writable]` nft_receipt
///   8. `[optional]` system_program (default to `11111111111111111111111111111111`)
#[derive(Clone, Debug, Default)]
pub struct DepositNftCoreBuilder {
    asset: Option<solana_program::pubkey::Pubkey>,
    collection: Option<solana_program::pubkey::Pubkey>,
    mpl_core_program: Option<solana_program::pubkey::Pubkey>,
    owner: Option<solana_program::pubkey::Pubkey>,
    pool: Option<solana_program::pubkey::Pubkey>,
    whitelist: Option<solana_program::pubkey::Pubkey>,
    mint_proof: Option<solana_program::pubkey::Pubkey>,
    nft_receipt: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl DepositNftCoreBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    /// The MPL core asset account.
    #[inline(always)]
    pub fn asset(&mut self, asset: solana_program::pubkey::Pubkey) -> &mut Self {
        self.asset = Some(asset);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn collection(&mut self, collection: Option<solana_program::pubkey::Pubkey>) -> &mut Self {
        self.collection = collection;
        self
    }
    /// `[optional account, default to 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d']`
    /// The MPL Core program.
    #[inline(always)]
    pub fn mpl_core_program(
        &mut self,
        mpl_core_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.mpl_core_program = Some(mpl_core_program);
        self
    }
    /// The owner of the pool and the NFT.
    #[inline(always)]
    pub fn owner(&mut self, owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.owner = Some(owner);
        self
    }
    /// The pool the asset is being transferred to/from.
    #[inline(always)]
    pub fn pool(&mut self, pool: solana_program::pubkey::Pubkey) -> &mut Self {
        self.pool = Some(pool);
        self
    }
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[inline(always)]
    pub fn whitelist(&mut self, whitelist: solana_program::pubkey::Pubkey) -> &mut Self {
        self.whitelist = Some(whitelist);
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
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[inline(always)]
    pub fn nft_receipt(&mut self, nft_receipt: solana_program::pubkey::Pubkey) -> &mut Self {
        self.nft_receipt = Some(nft_receipt);
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    /// The Solana system program.
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
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
        let accounts = DepositNftCore {
            asset: self.asset.expect("asset is not set"),
            collection: self.collection,
            mpl_core_program: self.mpl_core_program.unwrap_or(solana_program::pubkey!(
                "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
            )),
            owner: self.owner.expect("owner is not set"),
            pool: self.pool.expect("pool is not set"),
            whitelist: self.whitelist.expect("whitelist is not set"),
            mint_proof: self.mint_proof,
            nft_receipt: self.nft_receipt.expect("nft_receipt is not set"),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
        };

        accounts.instruction_with_remaining_accounts(&self.__remaining_accounts)
    }
}

/// `deposit_nft_core` CPI accounts.
pub struct DepositNftCoreCpiAccounts<'a, 'b> {
    /// The MPL core asset account.
    pub asset: &'b solana_program::account_info::AccountInfo<'a>,

    pub collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The MPL Core program.
    pub mpl_core_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The owner of the pool and the NFT.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool the asset is being transferred to/from.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    pub mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Solana system program.
    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `deposit_nft_core` CPI instruction.
pub struct DepositNftCoreCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The MPL core asset account.
    pub asset: &'b solana_program::account_info::AccountInfo<'a>,

    pub collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The MPL Core program.
    pub mpl_core_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The owner of the pool and the NFT.
    pub owner: &'b solana_program::account_info::AccountInfo<'a>,
    /// The pool the asset is being transferred to/from.
    pub pool: &'b solana_program::account_info::AccountInfo<'a>,
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    pub whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    pub mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    pub nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    /// The Solana system program.
    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

impl<'a, 'b> DepositNftCoreCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: DepositNftCoreCpiAccounts<'a, 'b>,
    ) -> Self {
        Self {
            __program: program,
            asset: accounts.asset,
            collection: accounts.collection,
            mpl_core_program: accounts.mpl_core_program,
            owner: accounts.owner,
            pool: accounts.pool,
            whitelist: accounts.whitelist,
            mint_proof: accounts.mint_proof,
            nft_receipt: accounts.nft_receipt,
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
        let mut accounts = Vec::with_capacity(9 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.asset.key,
            false,
        ));
        if let Some(collection) = self.collection {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *collection.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::TENSOR_AMM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mpl_core_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
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
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.nft_receipt.key,
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
        let data = DepositNftCoreInstructionData::new().try_to_vec().unwrap();

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::TENSOR_AMM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(9 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.asset.clone());
        if let Some(collection) = self.collection {
            account_infos.push(collection.clone());
        }
        account_infos.push(self.mpl_core_program.clone());
        account_infos.push(self.owner.clone());
        account_infos.push(self.pool.clone());
        account_infos.push(self.whitelist.clone());
        if let Some(mint_proof) = self.mint_proof {
            account_infos.push(mint_proof.clone());
        }
        account_infos.push(self.nft_receipt.clone());
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

/// Instruction builder for `DepositNftCore` via CPI.
///
/// ### Accounts:
///
///   0. `[writable]` asset
///   1. `[optional]` collection
///   2. `[]` mpl_core_program
///   3. `[writable, signer]` owner
///   4. `[writable]` pool
///   5. `[]` whitelist
///   6. `[optional]` mint_proof
///   7. `[writable]` nft_receipt
///   8. `[]` system_program
#[derive(Clone, Debug)]
pub struct DepositNftCoreCpiBuilder<'a, 'b> {
    instruction: Box<DepositNftCoreCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> DepositNftCoreCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(DepositNftCoreCpiBuilderInstruction {
            __program: program,
            asset: None,
            collection: None,
            mpl_core_program: None,
            owner: None,
            pool: None,
            whitelist: None,
            mint_proof: None,
            nft_receipt: None,
            system_program: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    /// The MPL core asset account.
    #[inline(always)]
    pub fn asset(&mut self, asset: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.asset = Some(asset);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn collection(
        &mut self,
        collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.collection = collection;
        self
    }
    /// The MPL Core program.
    #[inline(always)]
    pub fn mpl_core_program(
        &mut self,
        mpl_core_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.mpl_core_program = Some(mpl_core_program);
        self
    }
    /// The owner of the pool and the NFT.
    #[inline(always)]
    pub fn owner(&mut self, owner: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.owner = Some(owner);
        self
    }
    /// The pool the asset is being transferred to/from.
    #[inline(always)]
    pub fn pool(&mut self, pool: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.pool = Some(pool);
        self
    }
    /// The whitelist that gatekeeps which NFTs can be deposited into the pool.
    /// Must match the whitelist stored in the pool state.
    #[inline(always)]
    pub fn whitelist(
        &mut self,
        whitelist: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.whitelist = Some(whitelist);
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
    /// The NFT deposit receipt, which ties an NFT to the pool it was deposited to.
    #[inline(always)]
    pub fn nft_receipt(
        &mut self,
        nft_receipt: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.nft_receipt = Some(nft_receipt);
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
        let instruction = DepositNftCoreCpi {
            __program: self.instruction.__program,

            asset: self.instruction.asset.expect("asset is not set"),

            collection: self.instruction.collection,

            mpl_core_program: self
                .instruction
                .mpl_core_program
                .expect("mpl_core_program is not set"),

            owner: self.instruction.owner.expect("owner is not set"),

            pool: self.instruction.pool.expect("pool is not set"),

            whitelist: self.instruction.whitelist.expect("whitelist is not set"),

            mint_proof: self.instruction.mint_proof,

            nft_receipt: self
                .instruction
                .nft_receipt
                .expect("nft_receipt is not set"),

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
struct DepositNftCoreCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    asset: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mpl_core_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    pool: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    whitelist: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mint_proof: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    nft_receipt: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
