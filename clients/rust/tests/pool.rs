#![cfg(feature = "test-sbf")]
pub mod setup;

use amm::{
    accounts::Pool,
    instructions::{ClosePool, ClosePoolInstructionArgs, ReallocPool, ReallocPoolInstructionArgs},
};
use borsh::BorshDeserialize;
use solana_program_test::tokio;
use solana_sdk::{
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};

use crate::setup::{
    airdrop, program_context, setup_default_pool, setup_default_whitelist, TestPool,
    TestPoolInputs, TestWhitelist, TestWhitelistInputs, ONE_SOL_LAMPORTS,
};

#[tokio::test]
async fn create_pool() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let owner = Keypair::new();
    let cosigner = Keypair::new();
    let identifier = Keypair::new();

    airdrop(&mut context, &owner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();
    airdrop(&mut context, &cosigner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    // Set up a basic whitelist.
    let TestWhitelist { whitelist, .. } = setup_default_whitelist(
        &mut context,
        TestWhitelistInputs {
            owner: &owner,
            cosigner: &cosigner,
            identifier: identifier.pubkey().to_bytes(),
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            owner: &owner,
            cosigner: &cosigner,
            identifier: identifier.pubkey(),
            whitelist,
            // Use defaults for the rest
            pool_type: None,
            curve_type: None,
            starting_price: None,
            delta: None,
            mm_compound_fees: None,
            mm_fee_bps: None,
        },
    )
    .await;

    // Then an account was created with the correct data.
    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool = Pool::deserialize(&mut account_data).unwrap();
    assert_eq!(pool.config, config);
}

#[tokio::test]
pub async fn realloc_pool() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let owner = Keypair::new();
    let cosigner = Keypair::new();
    let identifier = Keypair::new();

    airdrop(&mut context, &owner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();
    airdrop(&mut context, &cosigner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    // Set up a basic whitelist.
    let TestWhitelist { whitelist, .. } = setup_default_whitelist(
        &mut context,
        TestWhitelistInputs {
            owner: &owner,
            cosigner: &cosigner,
            identifier: identifier.pubkey().to_bytes(),
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            owner: &owner,
            cosigner: &cosigner,
            identifier: identifier.pubkey(),
            whitelist,
            // Use defaults for the rest
            pool_type: None,
            curve_type: None,
            starting_price: None,
            delta: None,
            mm_compound_fees: None,
            mm_fee_bps: None,
        },
    )
    .await;

    // Then an account was created with the correct data.
    let account = context.banks_client.get_account(pool).await.unwrap();

    // Account exists
    assert!(account.is_some());
    let account = account.unwrap();

    // Account has the correct data
    let mut account_data = account.data.as_ref();
    let pool_data = Pool::deserialize(&mut account_data).unwrap();
    assert_eq!(pool_data.config, config);

    // When the pool is reallocated
    let ix = ReallocPool {
        pool,
        whitelist,
        owner: owner.pubkey(),
        cosigner: cosigner.pubkey(),
        system_program: system_program::id(),
    }
    .instruction(ReallocPoolInstructionArgs {
        config: config.clone(),
    });

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &cosigner],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // TO-DO: Account injection to simulate actually reallocating the pool size, as
    // POOL_SIZE doesn't change right now.
}

#[tokio::test]
async fn close_pool() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let owner = Keypair::new();
    let cosigner = Keypair::new();
    let identifier = Keypair::new();

    airdrop(&mut context, &owner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();
    airdrop(&mut context, &cosigner.pubkey(), ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    // Set up a basic whitelist.
    let TestWhitelist { whitelist, .. } = setup_default_whitelist(
        &mut context,
        TestWhitelistInputs {
            owner: &owner,
            cosigner: &cosigner,
            identifier: identifier.pubkey().to_bytes(),
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            owner: &owner,
            cosigner: &cosigner,
            identifier: identifier.pubkey(),
            whitelist,
            // Use defaults for the rest
            pool_type: None,
            curve_type: None,
            starting_price: None,
            delta: None,
            mm_compound_fees: None,
            mm_fee_bps: None,
        },
    )
    .await;

    // Then an account was created with the correct data.
    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool_data = Pool::deserialize(&mut account_data).unwrap();
    assert_eq!(pool_data.config, config);

    // When the pool is closed
    let ix = ClosePool {
        pool,
        whitelist,
        sol_escrow: pool_data.sol_escrow,
        owner: owner.pubkey(),
        system_program: system_program::id(),
    }
    .instruction(ClosePoolInstructionArgs { config });

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &owner],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then the account is gone
    let account = context.banks_client.get_account(pool).await.unwrap();
    assert!(account.is_none());
}
