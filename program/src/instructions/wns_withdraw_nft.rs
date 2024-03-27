// //! User withdrawing an NFT from their Trade pool

// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token_interface::{self, CloseAccount, Mint, Token2022, TokenAccount, TransferChecked},
// };
// use tensor_toolbox::token_2022::{
//     transfer::transfer_checked,
//     wns::{wns_approve, wns_validate_mint, ApproveAccounts},
// };
// use tensor_whitelist::Whitelist;
// use vipers::{throw_err, unwrap_int, Validate};

// use self::constants::CURRENT_POOL_VERSION;
// use crate::{error::ErrorCode, *};

// #[derive(Accounts)]
// #[instruction(config: PoolConfig)]
// pub struct WnsWithdrawNft<'info> {
//     #[account(
//         mut,
//         seeds = [
//             b"pool",
//             owner.key().as_ref(),
//             whitelist.key().as_ref(),
//         ],
//         bump = pool.bump[0],
//         has_one = whitelist, has_one = owner,
//         // can only withdraw from NFT or Trade pool (bought NFTs from Token goes directly to owner)
//         constraint = config.pool_type == PoolType::NFT || config.pool_type == PoolType::Trade @ ErrorCode::WrongPoolType,
//     )]
//     pub pool: Box<Account<'info, Pool>>,

//     /// CHECK: has_one = whitelist in pool
//     #[account(
//         seeds = [&whitelist.uuid],
//         bump,
//         seeds::program = tensor_whitelist::ID
//     )]
//     pub whitelist: Box<Account<'info, Whitelist>>,

//     #[account(
//         init_if_needed,
//         payer = owner,
//         associated_token::mint = nft_mint,
//         associated_token::authority = owner,
//     )]
//     pub nft_dest: Box<InterfaceAccount<'info, TokenAccount>>,

//     #[account(
//         constraint = nft_mint.key() == nft_escrow.mint @ ErrorCode::WrongMint,
//         constraint = nft_mint.key() == nft_receipt.nft_mint @ ErrorCode::WrongMint,
//         mint::token_program = anchor_spl::token_interface::spl_token_2022::id(),
//     )]
//     pub nft_mint: Box<InterfaceAccount<'info, Mint>>,

//     /// CHECK: seeds checked so must be Tamm PDA
//     #[account(mut,
//     seeds = [
//         b"nft_owner",
//         nft_mint.key().as_ref(),
//         ],
//         bump
//     )]
//     pub nft_escrow_owner: AccountInfo<'info>,

//     /// Implicitly checked via transfer. Will fail if wrong account
//     /// This is closed below (dest = owner)
//     #[account(
//         mut,
//         seeds=[
//             b"nft_escrow".as_ref(),
//             nft_mint.key().as_ref(),
//         ],
//         bump,
//         token::mint = nft_mint, token::authority = nft_escrow_owner,
//     )]
//     pub nft_escrow: Box<InterfaceAccount<'info, TokenAccount>>,

//     #[account(
//         mut,
//         seeds=[
//             b"nft_receipt".as_ref(),
//             nft_mint.key().as_ref(),
//         ],
//         bump = nft_receipt.bump,
//         close = owner,
//         //can't withdraw an NFT that's associated with a different pool
//         // redundant but extra safety
//         constraint = nft_receipt.nft_mint == nft_mint.key() && nft_receipt.nft_escrow == nft_escrow.key() @ ErrorCode::WrongMint,
//     )]
//     pub nft_receipt: Box<Account<'info, NftDepositReceipt>>,

//     /// Tied to the pool because used to verify pool seeds
//     #[account(mut)]
//     pub owner: Signer<'info>,

//     pub token_program: Program<'info, Token2022>,

//     pub associated_token_program: Program<'info, AssociatedToken>,

//     pub system_program: Program<'info, System>,

//     // ---- WNS royalty enforcement
//     /// CHECK: checked on approve CPI
//     #[account(mut)]
//     pub approve_account: UncheckedAccount<'info>,

//     /// CHECK: checked on approve CPI
//     #[account(mut)]
//     pub distribution: UncheckedAccount<'info>,

//     /// CHECK: checked on approve CPI
//     pub wns_program: UncheckedAccount<'info>,

//     /// CHECK: checked on approve CPI
//     pub distribution_program: UncheckedAccount<'info>,

//     /// CHECK: checked on transfer CPI
//     pub extra_metas: UncheckedAccount<'info>,
// }

// impl<'info> WnsWithdrawNft<'info> {
//     fn close_nft_escrow_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
//         CpiContext::new(
//             self.token_program.to_account_info(),
//             CloseAccount {
//                 account: self.nft_escrow.to_account_info(),
//                 destination: self.owner.to_account_info(),
//                 authority: self.nft_escrow_owner.to_account_info(),
//             },
//         )
//     }
// }

// impl<'info> Validate<'info> for WnsWithdrawNft<'info> {
//     fn validate(&self) -> Result<()> {
//         if self.pool.version != CURRENT_POOL_VERSION {
//             throw_err!(ErrorCode::WrongPoolVersion);
//         }
//         Ok(())
//     }
// }

// #[access_control(ctx.accounts.validate())]
// pub fn process_wns_withdraw_nft<'info>(
//     ctx: Context<'_, '_, '_, 'info, WnsWithdrawNft<'info>>,
// ) -> Result<()> {
//     // validate mint account

//     wns_validate_mint(&ctx.accounts.nft_mint.to_account_info())?;

//     let approve_accounts = ApproveAccounts {
//         payer: ctx.accounts.owner.to_account_info(),
//         authority: ctx.accounts.owner.to_account_info(),
//         mint: ctx.accounts.nft_mint.to_account_info(),
//         approve_account: ctx.accounts.approve_account.to_account_info(),
//         payment_mint: None,
//         distribution_token_account: ctx.accounts.distribution_token_account.to_account_info(),
//         // payer_address: ctx.accounts.owner.to_account_info(),
//         // distribution: ctx.accounts.distribution.to_account_info(),
//         // distribution_address: ctx.accounts.distribution.to_account_info(),
//         system_program: ctx.accounts.system_program.to_account_info(),
//         distribution_program: ctx.accounts.distribution_program.to_account_info(),
//         wns_program: ctx.accounts.wns_program.to_account_info(),
//         token_program: ctx.accounts.token_program.to_account_info(),
//         associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
//     };
//     // "simulate" royalty payment
//     wns_approve(approve_accounts, 0, 0)?;

//     // transfer the NFT

//     let transfer_cpi = CpiContext::new(
//         ctx.accounts.token_program.to_account_info(),
//         TransferChecked {
//             from: ctx.accounts.nft_escrow.to_account_info(),
//             to: ctx.accounts.nft_dest.to_account_info(),
//             authority: ctx.accounts.nft_escrow_owner.to_account_info(),
//             mint: ctx.accounts.nft_mint.to_account_info(),
//         },
//     );

//     let nft_mint_pubkey = ctx.accounts.nft_mint.key();

//     let signer_seeds: &[&[&[u8]]] = &[&[
//         b"nft_owner",
//         nft_mint_pubkey.as_ref(),
//         &[ctx.bumps.nft_escrow_owner],
//     ]];

//     transfer_checked(
//         transfer_cpi
//             .with_remaining_accounts(vec![
//                 ctx.accounts.wns_program.to_account_info(),
//                 ctx.accounts.extra_metas.to_account_info(),
//                 ctx.accounts.approve_account.to_account_info(),
//             ])
//             .with_signer(signer_seeds),
//         1, // supply = 1
//         0, // decimals = 0
//     )?;

//     // close nft escrow account
//     token_interface::close_account(
//         ctx.accounts
//             .close_nft_escrow_ctx()
//             .with_signer(signer_seeds),
//     )?;

//     //update pool
//     let pool = &mut ctx.accounts.pool;
//     pool.nfts_held = unwrap_int!(pool.nfts_held.checked_sub(1));

//     Ok(())
// }
