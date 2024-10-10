#![cfg(feature = "test-sbf")]
pub mod setup;

use borsh::BorshDeserialize;
use solana_program_test::tokio;
use solana_sdk::{
    clock::Clock,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};
use tensor_amm::{
    accounts::Pool,
    instructions::{
        CloseExpiredPool, ClosePool, DepositSol, DepositSolInstructionArgs, EditPool,
        EditPoolInstructionArgs,
    },
    types::{CurveType, PoolConfig},
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
            payer: &update_authority_signer,
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
            payer: &update_authority_signer,
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
        rent_payer: update_authority,
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
async fn close_expired_pool() {
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
            payer: &update_authority_signer,
            owner: &update_authority_signer,
            whitelist,
            expire_in_sec: Some(1),
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
    assert_eq!(pool_data.expiry, pool_data.created_at + 1);

    // Warp ahead so the pool expires
    context.warp_to_slot(2000).unwrap();

    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool_data = Pool::deserialize(&mut account_data).unwrap();
    let clock = context.banks_client.get_sysvar::<Clock>().await.unwrap();
    let now = clock.unix_timestamp;

    // The pool has expired
    assert!(now > pool_data.expiry);

    let ix = CloseExpiredPool {
        rent_payer: update_authority,
        pool,
        owner: update_authority,
        system_program: system_program::id(),
    }
    .instruction();

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer], // No signers other than tx payer--permissionless close
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then the account is gone
    let account = context.banks_client.get_account(pool).await.unwrap();
    assert!(account.is_none());
}

#[tokio::test]
async fn close_expired_pool_returns_excess_lamports_to_owner() {
    // Set up program context with Tamm and WhiteList programs
    let mut context = program_context().await;

    // Set up signers and identity and fund them.
    let rent_payer_signer = Keypair::new();
    let rent_payer = rent_payer_signer.pubkey();
    let pool_owner_signer = Keypair::new();
    let pool_owner = pool_owner_signer.pubkey();

    airdrop(&mut context, &rent_payer, 2 * ONE_SOL_LAMPORTS)
        .await
        .unwrap();
    airdrop(&mut context, &pool_owner, 2 * ONE_SOL_LAMPORTS)
        .await
        .unwrap();

    // Set up a basic whitelist.
    let TestWhitelistV2 { whitelist, .. } = setup_default_whitelist(
        &mut context,
        TestWhitelistV2Inputs {
            update_authority_signer: &pool_owner_signer,
            ..Default::default()
        },
    )
    .await;

    // When a pool is created
    let TestPool { pool, config, .. } = setup_default_pool(
        &mut context,
        TestPoolInputs {
            payer: &rent_payer_signer,
            owner: &pool_owner_signer,
            whitelist,
            expire_in_sec: Some(1),
            ..Default::default()
        },
    )
    .await;

    // And the owner has deposited 1 SOL
    let deposit_ix = DepositSol {
        pool,
        owner: pool_owner,
        system_program: system_program::id(),
    }
    .instruction(DepositSolInstructionArgs {
        lamports: ONE_SOL_LAMPORTS,
    });

    let tx = Transaction::new_signed_with_payer(
        &[deposit_ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &pool_owner_signer],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then an account was created with the correct data.
    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool_data = Pool::deserialize(&mut account_data).unwrap();
    assert_eq!(pool_data.config, config);
    assert_eq!(pool_data.expiry, pool_data.created_at + 1);

    // Warp ahead so the pool expires
    context.warp_to_slot(2000).unwrap();

    let account = context.banks_client.get_account(pool).await.unwrap();

    assert!(account.is_some());

    let account = account.unwrap();

    let mut account_data = account.data.as_ref();
    let pool_data = Pool::deserialize(&mut account_data).unwrap();
    let clock = context.banks_client.get_sysvar::<Clock>().await.unwrap();
    let now = clock.unix_timestamp;

    let rent_payer_balance_before = context.banks_client.get_balance(rent_payer).await.unwrap();
    let owner_balance_before = context.banks_client.get_balance(pool_owner).await.unwrap();

    // The pool has expired
    assert!(now > pool_data.expiry);

    let ix = CloseExpiredPool {
        rent_payer,
        pool,
        owner: pool_owner,
        system_program: system_program::id(),
    }
    .instruction();

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer], // No signers other than tx payer--permissionless close
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    // Then the account is gone
    let account = context.banks_client.get_account(pool).await.unwrap();
    assert!(account.is_none());

    // And the owner has received 1 minus the rent back
    let rent = context.banks_client.get_rent().await.unwrap();
    let pool_rent = rent.minimum_balance(Pool::LEN);

    let rent_payer_balance_after = context.banks_client.get_balance(rent_payer).await.unwrap();
    let owner_balance_after = context.banks_client.get_balance(pool_owner).await.unwrap();
    assert_eq!(owner_balance_after, owner_balance_before + ONE_SOL_LAMPORTS);
    assert_eq!(
        rent_payer_balance_after,
        rent_payer_balance_before + pool_rent
    );
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
            payer: &update_authority_signer,
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
        expire_in_sec: None,
        reset_price_offset: true,
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
