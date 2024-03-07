#![cfg(feature = "test-sbf")]
pub mod setup;

use amm::{
    accounts::{Pool, SolEscrow},
    instructions::CreatePoolBuilder,
    types::{CurveType, PoolConfig, PoolType},
};
use borsh::BorshDeserialize;
use solana_program_test::tokio;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use tensor_whitelist::{
    accounts::Whitelist,
    instructions::{
        InitUpdateAuthority, InitUpdateAuthorityInstructionArgs, InitUpdateWhitelistBuilder,
    },
};

use crate::setup::{airdrop, program_context, ONE_SOL_LAMPORTS};

#[tokio::test]
async fn create_pool() {
    let mut context = program_context().await;

    let owner = Keypair::new();
    let cosigner = Keypair::new();
    let identifier = Keypair::new();

    airdrop(&mut context, &owner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();
    airdrop(&mut context, &cosigner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    let pool = Pool::find_pda(&owner.pubkey(), &identifier.pubkey()).0;
    let sol_escrow = SolEscrow::find_pda(&pool).0;

    // Create basic whitelist for testing.
    let whitelist_authority = Pubkey::find_program_address(&[], &tensor_whitelist::ID).0;
    let whitelist = Whitelist::find_pda(identifier.pubkey().to_bytes()).0;

    // Init the singleton.
    let args = InitUpdateAuthorityInstructionArgs {
        new_cosigner: Some(cosigner.pubkey()),
        new_owner: Some(owner.pubkey()),
    };

    let ix1 = InitUpdateAuthority {
        whitelist_authority,
        cosigner: cosigner.pubkey(),
        owner: owner.pubkey(),
        system_program: system_program::ID,
    }
    .instruction(args);

    // Create the whitelist.
    let ix2 = InitUpdateWhitelistBuilder::new()
        .whitelist(whitelist)
        .whitelist_authority(whitelist_authority)
        .uuid(identifier.pubkey().to_bytes())
        .cosigner(cosigner.pubkey())
        .fvc(owner.pubkey())
        .name(identifier.pubkey().to_bytes())
        .instruction();

    let tx = Transaction::new_signed_with_payer(
        &[ix1, ix2],
        Some(&context.payer.pubkey()),
        &[&context.payer, &owner, &cosigner],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    let config = PoolConfig {
        pool_type: PoolType::Token,
        curve_type: CurveType::Linear,
        starting_price: 1,
        delta: 1,
        mm_compound_fees: false,
        mm_fee_bps: None,
    };

    let ix = CreatePoolBuilder::new()
        .owner(owner.pubkey())
        .pool(pool)
        .sol_escrow(sol_escrow)
        .whitelist(whitelist)
        .identifier(identifier.pubkey().to_bytes())
        .config(config.clone())
        .cosigner(cosigner.pubkey())
        .order_type(0)
        .instruction();

    // When we create a new account.

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &owner],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then an account was created with the correct data.
    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool = Pool::deserialize(&mut account_data).unwrap();
    assert_eq!(pool.config, config);
}
