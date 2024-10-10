pub mod buy_nft;
pub mod deposit_nft;
pub mod sell_nft_token_pool;
pub mod sell_nft_trade_pool;
pub mod withdraw_nft;

pub use self::buy_nft::*;
pub use self::deposit_nft::*;
pub use self::sell_nft_token_pool::*;
pub use self::sell_nft_trade_pool::*;
pub use self::withdraw_nft::*;

use crate::*;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Token2022, TokenAccount, TransferChecked},
};
use mpl_token_metadata::types::Creator;
use tensor_toolbox::{close_account, token_2022::transfer::transfer_checked};
use tensor_vipers::{throw_err, unwrap_int};

struct TransferArgs<'info> {
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
}

fn transfer<'info>(
    args: &TransferArgs<'info>,
    remaining_accounts: &[AccountInfo<'info>],
    royalty_creators: &Option<Vec<Creator>>,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<Vec<AccountInfo<'info>>> {
    // Setup the transfer CPI
    let mut transfer_cpi: CpiContext<'_, '_, '_, '_, TransferChecked<'_>> = CpiContext::new(
        args.token_program.to_account_info(),
        TransferChecked {
            from: args.from.to_account_info(),
            to: args.to.to_account_info(),
            authority: args.authority.to_account_info(),
            mint: args.mint.to_account_info(),
        },
    );

    let creator_accounts = if let Some(ref creators) = royalty_creators {
        transfer_cpi = transfer_cpi.with_remaining_accounts(remaining_accounts.to_vec());

        creators
            .iter()
            .filter_map(|c| {
                remaining_accounts
                    .iter()
                    .find(|account| &c.address == account.key)
                    .cloned()
            })
            .collect()
    } else {
        vec![]
    };

    // Perform the transfer
    transfer_checked(
        transfer_cpi.with_signer(signer_seeds.unwrap_or_default()),
        1, // supply = 1
        0, // decimals = 0
    )?;

    Ok(creator_accounts)
}
