#![cfg(feature = "test-sbf")]
pub mod setup;

use amm::{
    accounts::Pool,
    instructions::{ClosePool, EditPool, EditPoolInstructionArgs},
    types::{CurveType, PoolConfig},
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
    TestPoolInputs, TestWhitelistV2, TestWhitelistV2Inputs, ONE_SOL_LAMPORTS,
};

#[tokio::test]
async fn create_pool() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let update_authority_signer = Keypair::new();

    airdrop(
        &mut context,
        &update_authority_signer.pubkey(),
        ONE_SOL_LAMPORTS,
    )
    .await
    .unwrap();

    // Set up a basic whitelist.
    let TestWhitelistV2 { whitelist, .. } = setup_default_whitelist(
        &mut context,
        TestWhitelistV2Inputs {
            update_authority_signer: &update_authority_signer,
            ..Default::default()
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            owner: &update_authority_signer,
            whitelist,
            ..Default::default()
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
async fn close_pool() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let update_authority_signer = Keypair::new();
    let update_authority = update_authority_signer.pubkey();

    airdrop(&mut context, &update_authority, ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    // Set up a basic whitelist.
    let TestWhitelistV2 {
        whitelist,
        update_authority,
        ..
    } = setup_default_whitelist(
        &mut context,
        TestWhitelistV2Inputs {
            update_authority_signer: &update_authority_signer,
            ..Default::default()
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            owner: &update_authority_signer,
            whitelist,
            ..Default::default()
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
        owner: update_authority,
        system_program: system_program::id(),
    }
    .instruction();

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &update_authority_signer],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then the account is gone
    let account = context.banks_client.get_account(pool).await.unwrap();
    assert!(account.is_none());
}

#[tokio::test]
async fn edit_pool() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let update_authority_signer = Keypair::new();
    let update_authority = update_authority_signer.pubkey();

    airdrop(&mut context, &update_authority, ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    // Set up a basic whitelist.
    let TestWhitelistV2 {
        whitelist,
        update_authority,
        ..
    } = setup_default_whitelist(
        &mut context,
        TestWhitelistV2Inputs {
            update_authority_signer: &update_authority_signer,
            ..Default::default()
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            owner: &update_authority_signer,
            whitelist,
            ..Default::default()
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

    let new_config = PoolConfig {
        curve_type: CurveType::Exponential,
        starting_price: 10,
        delta: 3,
        ..config
    };

    let ix = EditPool {
        pool,
        owner: update_authority,
        system_program: system_program::id(),
    }
    .instruction(EditPoolInstructionArgs {
        new_config: Some(new_config.clone()),
        cosigner: None,
        max_taker_sell_count: None,
    });

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &update_authority_signer],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool_data = Pool::deserialize(&mut account_data).unwrap();
    assert_eq!(pool_data.config, new_config);
}
