//! User selling an NFT into a Token pool
//! We separate this from Trade pool since the owner will receive the NFT directly in their ATA.
//! (!) Keep common logic in sync with sell_nft_token_pool.rs.

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_token_metadata::types::AuthorizationData;
use solana_program::keccak;
use tensor_toolbox::{
    assert_decode_metadata, transfer_creators_fee, transfer_lamports_from_pda, CreatorFeeMode,
    FromAcc, PnftTransferArgs,
};
use tensor_whitelist::{FullMerkleProof, WhitelistV2};
use vipers::{throw_err, unwrap_int, Validate};

use self::constants::CURRENT_POOL_VERSION;
use crate::{error::ErrorCode, utils::send_pnft, *};

/// Sells an NFT into a one-sided ("Token") pool where the NFT is temporarily escrowed before 
/// being transferred to the pool owner--the buyer. The seller is the NFT owner and receives the pool's current price in return.
#[derive(Accounts)]
pub struct SellNftTokenPool<'info> {
    /// The owner of the pool and the buyer/recipient of the NFT.
    /// CHECK: has_one = owner in pool
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// The seller is the owner of the NFT who is selling the NFT into the pool.
    #[account(mut)]
    pub seller: Signer<'info>,

    // TODO: Flattened SellNftShared accounts because Kinobi doesn't currently support nested accounts

    /// CHECK: Seeds checked here, account has no state.
    #[account(
        mut,
        seeds = [
            b"fee_vault",
            // Use the last byte of the mint as the fee shard number
            &mint.key().as_ref().last().unwrap().to_le_bytes(), 
        ],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    /// The Pool state account that the NFT is being sold into. Stores pool state and config,
    /// but is also the owner of any NFTs in the pool, and also escrows any SOL.
    /// Any pool can be specified provided it is a Token type and the NFT passes at least one
    /// whitelist condition.
    #[account(mut,
        has_one = whitelist @ ErrorCode::BadWhitelist,
        constraint = pool.config.pool_type == PoolType::Token @ ErrorCode::WrongPoolType,
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The whitelist account that the pool uses to verify the NFTs being sold into it.
    #[account(
        seeds = [b"whitelist", &whitelist.namespace.as_ref(), &whitelist.uuid],
        bump,
        seeds::program = tensor_whitelist::ID
    )]
    pub whitelist: Box<Account<'info, WhitelistV2>>,

    /// Optional account which must be passed in if the NFT must be verified against a
    /// merkle proof condition in the whitelist.
    /// CHECK: seeds and ownership are checked in assert_decode_mint_proof_v2.
    pub mint_proof: Option<UncheckedAccount<'info>>,

    /// The token account of the NFT for the seller's wallet.
    /// Typically, this should be an ATA for the mint and seller wallet.
    #[account(mut, token::mint = mint, token::authority = seller)]
    pub seller_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the owner, where the NFT will be transferred to as a result of this sale.
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The ATA of the pool, where the NFT token is temporarily escrowed as a result of this sale.
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint account of the NFT being sold.
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// The Token Metadata metadata account of the NFT.
    ///  CHECK: seeds and ownership are checked in assert_decode_metadata.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Either the legacy token program or token-2022.
    pub token_program: Interface<'info, TokenInterface>,
    /// The SPL associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// The SPL system program.
    pub system_program: Program<'info, System>,

    // --------------------------------------- pNft

    /// The Token Metadata edition account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    //note that MASTER EDITION and EDITION share the same seeds, and so it's valid to check them here
    pub edition: UncheckedAccount<'info>,

    /// The Token Metadata owner/buyer token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub owner_token_record: UncheckedAccount<'info>,

    /// The Token Metadata seller/source token record account of the NFT.
    /// CHECK: seeds checked on Token Metadata CPI
    #[account(mut)]
    pub seller_token_record: UncheckedAccount<'info>,

    /// The Token Metadata pool temporary token record account of the NFT.
    /// CHECK: seeds checked here
    #[account(mut,
            seeds=[
            mpl_token_metadata::accounts::TokenRecord::PREFIX.0,
            mpl_token_metadata::ID.as_ref(),
            mint.key().as_ref(),
            mpl_token_metadata::accounts::TokenRecord::PREFIX.1,
            pool_ata.key().as_ref()
        ],
        seeds::program = mpl_token_metadata::ID,
        bump
    )]
    pub pool_token_record: UncheckedAccount<'info>,

    // Todo: add ProgNftShared back in, if possible
    // pub pnft_shared: ProgNftShared<'info>,
    /// The Token Metadata program account.
    /// CHECK: address constraint is checked here
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// The sysvar instructions account.
    /// CHECK: address constraint is checked here
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,

    /// The Metaplex Token Authority Rules program account.
    /// CHECK: address constraint is checked here
    #[account(address = MPL_TOKEN_AUTH_RULES_ID)]
    pub authorization_rules_program: UncheckedAccount<'info>,

    /// The Metaplex Token Authority Rules account that stores royalty enforcement rules.
    /// CHECK: validated by mplex's pnft code
    pub auth_rules: UncheckedAccount<'info>,

    /// The shared escrow account for pools that pool liquidity in a shared account.
    /// CHECK: optional, manually handled in handler: 1)seeds, 2)program owner, 3)normal owner, 4)margin acc stored on pool
    #[account(mut)]
    pub shared_escrow: UncheckedAccount<'info>,

    /// The taker broker account that receives the taker fees.
    /// TODO: optional account? what checks?
    /// CHECK: need checks specified
    #[account(mut)]
    pub taker_broker: UncheckedAccount<'info>,

    /// The optional cosigner account that must be passed in if the pool has a cosigner.
    /// Checks are performed in the handler.
    pub cosigner: Option<Signer<'info>>,
    // remaining accounts:
    // optional 0 to N creator accounts
}

impl<'info> SellNftTokenPool<'info> {
    pub fn verify_whitelist(&self) -> Result<()> {
        let metadata = assert_decode_metadata(&self.mint.key(), &self.metadata)?;

        let full_merkle_proof = if let Some(mint_proof) = &self.mint_proof {
            let mint_proof = assert_decode_mint_proof_v2(&self.whitelist, &self.mint, mint_proof)?;

            let leaf = keccak::hash(self.mint.key().as_ref());
            let proof = &mut mint_proof.proof.to_vec();
            proof.truncate(mint_proof.proof_len as usize);
            Some(FullMerkleProof {
                leaf: leaf.0,
                proof: proof.clone(),
            })
        } else {
            None
        };

        self.whitelist
            .verify(metadata.collection, metadata.creators, full_merkle_proof)
    }
}

impl<'info> Validate<'info> for SellNftTokenPool<'info> {
    fn validate(&self) -> Result<()> {
        match self.pool.config.pool_type {
            PoolType::Token => (),
            _ => {
                throw_err!(ErrorCode::WrongPoolType);
            }
        }
        if self.pool.version != CURRENT_POOL_VERSION {
            throw_err!(ErrorCode::WrongPoolVersion);
        }

        self.pool.taker_allowed_to_sell()?;

        Ok(())
    }
}

impl<'info> SellNftTokenPool<'info> {
    fn close_pool_ata_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.pool_ata.to_account_info(),
                destination: self.seller.to_account_info(),
                authority: self.pool.to_account_info(),
            },
        )
    }
}

//ToDo: fix this
#[access_control(ctx.accounts.verify_whitelist(); ctx.accounts.validate())]
pub fn process_sell_nft_token_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, SellNftTokenPool<'info>>,
    // Min vs exact so we can add slippage later.
    min_price: u64,
    rules_acc_present: bool,
    authorization_data: Option<AuthorizationDataLocal>,
    optional_royalty_pct: Option<u16>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let owner_pubkey = ctx.accounts.owner.key();

    // --------------------------------------- send pnft

    // transfer nft directly to owner (ATA)
    // has to go before any transfer_lamports, o/w we get `sum of account balances before and after instruction do not match`
    let auth_rules_acc_info = &ctx.accounts.auth_rules.to_account_info();
    let auth_rules = if rules_acc_present {
        Some(auth_rules_acc_info)
    } else {
        None
    };

    let seller = &ctx.accounts.seller.to_account_info();
    let dest_owner = &ctx.accounts.pool.to_account_info();

    let pnft_args = Box::new(PnftTransferArgs {
        authority_and_owner: seller,
        payer: seller,
        source_ata: &ctx.accounts.seller_token_account,
        dest_ata: &ctx.accounts.pool_ata, //<- send to pool as escrow first
        dest_owner,
        nft_mint: &ctx.accounts.mint,
        nft_metadata: &ctx.accounts.metadata,
        nft_edition: &ctx.accounts.edition,
        system_program: &ctx.accounts.system_program,
        token_program: &ctx.accounts.token_program,
        ata_program: &ctx.accounts.associated_token_program,
        instructions: &ctx.accounts.instructions,
        owner_token_record: &ctx.accounts.seller_token_record,
        dest_token_record: &ctx.accounts.pool_token_record,
        authorization_rules_program: &ctx.accounts.authorization_rules_program,
        rules_acc: auth_rules,
        authorization_data: authorization_data.clone().map(AuthorizationData::from),
        delegate: None,
    });

    //STEP 1/2: SEND TO ESCROW
    msg!("Sending NFT to pool escrow");
    send_pnft(None, *pnft_args)?;

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"pool",
        owner_pubkey.as_ref(),
        pool.identifier.as_ref(),
        &[pool.bump[0]],
    ]];

    //STEP 2/2: SEND FROM ESCROW
    msg!("Sending NFT from pool escrow to owner");
    send_pnft(
        Some(signer_seeds),
        PnftTransferArgs {
            authority_and_owner: &ctx.accounts.pool.to_account_info(),
            payer: &ctx.accounts.seller.to_account_info(),
            source_ata: &ctx.accounts.pool_ata,
            dest_ata: &ctx.accounts.owner_ata,
            dest_owner: &ctx.accounts.owner.to_account_info(),
            nft_mint: &ctx.accounts.mint,
            nft_metadata: &ctx.accounts.metadata,
            nft_edition: &ctx.accounts.edition,
            system_program: &ctx.accounts.system_program,
            token_program: &ctx.accounts.token_program,
            ata_program: &ctx.accounts.associated_token_program,
            instructions: &ctx.accounts.instructions,
            owner_token_record: &ctx.accounts.pool_token_record,
            dest_token_record: &ctx.accounts.owner_token_record,
            authorization_rules_program: &ctx.accounts.authorization_rules_program,
            rules_acc: Some(auth_rules_acc_info),
            authorization_data: authorization_data.map(AuthorizationData::from),
            delegate: None,
        },
    )?;

    // close temp pool ata account, so it's not dangling
    token_interface::close_account(ctx.accounts.close_pool_ata_ctx().with_signer(signer_seeds))?;

    // TODO: remove?
    // USING DELEGATE (PAUSE TO NOT RELY ON DELEGATE RULE)
    // send_pnft(
    //     &ctx.accounts.shared.seller.to_account_info(),
    //     &ctx.accounts.shared.seller.to_account_info(),
    //     &ctx.accounts.shared.nft_seller_acc,
    //     &ctx.accounts.owner_ata_acc,
    //     &ctx.accounts.shared.owner.to_account_info(),
    //     &ctx.accounts.shared.nft_mint,
    //     &ctx.accounts.shared.nft_metadata,
    //     &ctx.accounts.nft_edition,
    //     &ctx.accounts.system_program,
    //     &ctx.accounts.token_program,
    //     &ctx.accounts.associated_token_program,
    //     &ctx.accounts.pnft_shared.instructions,
    //     &ctx.accounts.owner_token_record,
    //     &ctx.accounts.dest_token_record,
    //     &ctx.accounts.pnft_shared.authorization_rules_program,
    //     auth_rules,
    //     authorization_data
    //         .map(|authorization_data| AuthorizationData::try_from(authorization_data).unwrap()),
    //     Some(&ctx.accounts.nft_escrow_owner),
    //     Some(&ctx.accounts.nft_escrow_owner.to_account_info()),
    // )?;

    // --------------------------------------- end pnft

    // If the pool has a cosigner, the cosigner must be passed in, and must equal the pool's cosigner.
    if let Some(cosigner) = pool.cosigner {
        if ctx.accounts.cosigner.is_none()
            || ctx.accounts.cosigner.as_ref().unwrap().key != &cosigner
        {
            throw_err!(ErrorCode::BadCosigner);
        }
    }

    let metadata = &assert_decode_metadata(&ctx.accounts.mint.key(), &ctx.accounts.metadata)?;

    let current_price = pool.current_price(TakerSide::Sell)?;
    let Fees {
        tswap_fee,
        maker_rebate: _,
        broker_fee,
        taker_fee,
    } = calc_fees_rebates(current_price)?;
    let creators_fee = pool.calc_creators_fee(metadata, current_price, optional_royalty_pct)?;

    // for keeping track of current price + fees charged (computed dynamically)
    // we do this before PriceMismatch for easy debugging eg if there's a lot of slippage
    emit!(BuySellEvent {
        current_price,
        tswap_fee: taker_fee,
        mm_fee: 0, // no MM fee for token pool
        creators_fee,
    });

    if current_price < min_price {
        throw_err!(ErrorCode::PriceMismatch);
    }

    let mut left_for_seller = current_price;

    // --------------------------------------- SOL transfers
    //decide where we're sending the money from - margin (marginated pool) or escrow (normal pool)
    let from = match &pool.shared_escrow {
        Some(stored_shared_escrow) => {
            assert_decode_shared_escrow_account(
                &ctx.accounts.shared_escrow,
                &ctx.accounts.pool.to_account_info(),
            )?;
            if *ctx.accounts.shared_escrow.key != *stored_shared_escrow {
                throw_err!(ErrorCode::BadSharedEscrow);
            }
            ctx.accounts.shared_escrow.to_account_info()
        }
        None => ctx.accounts.pool.to_account_info(),
    };

    // transfer fees
    msg!("Transferring fees");
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(taker_fee));
    msg!("tswap fee: {}, broker fee: {}", tswap_fee, broker_fee);
    transfer_lamports_from_pda(&from, &ctx.accounts.fee_vault.to_account_info(), tswap_fee)?;
    transfer_lamports_from_pda(
        &from,
        &ctx.accounts.taker_broker.to_account_info(),
        broker_fee,
    )?;

    let remaining_accounts = &mut ctx.remaining_accounts.iter();

    // transfer royalties   
    msg!("Transferring royalties");
    let actual_creators_fee = transfer_creators_fee(
        &metadata
            .creators
            .clone()
            .unwrap_or(Vec::new())
            .into_iter()
            .map(Into::into)
            .collect(),
        remaining_accounts,
        creators_fee,
        &CreatorFeeMode::Sol {
            from: &FromAcc::Pda(&from),
        },
    )?;
    left_for_seller = unwrap_int!(left_for_seller.checked_sub(actual_creators_fee));

    // transfer remainder to seller
    // (!) fees/royalties are paid by TAKER, which in this case is the SELLER
    // (!) maker rebate already taken out of this amount
    msg!("Transferring remainder to seller");
    transfer_lamports_from_pda(
        &from,
        &ctx.accounts.seller.to_account_info(),
        left_for_seller,
    )?;

    // --------------------------------------- accounting

    //update pool accounting
    msg!("Updating pool accounting");
    let pool = &mut ctx.accounts.pool;
    pool.taker_sell_count = unwrap_int!(pool.taker_sell_count.checked_add(1));
    pool.stats.taker_sell_count = unwrap_int!(pool.stats.taker_sell_count.checked_add(1));
    pool.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
