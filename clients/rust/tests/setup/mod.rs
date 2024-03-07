use amm::{
    accounts::{Pool, SolEscrow},
    instructions::CreatePoolBuilder,
    types::{CurveType, PoolConfig, PoolType},
};
use solana_program_test::{BanksClientError, ProgramTest, ProgramTestContext};
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction, system_program,
    transaction::Transaction,
};
use tensor_whitelist::{
    accounts::Whitelist,
    instructions::{
        InitUpdateAuthority, InitUpdateAuthorityInstructionArgs, InitUpdateWhitelistBuilder,
    },
};

pub const ONE_SOL_LAMPORTS: u64 = 1_000_000_000;

pub async fn program_context() -> ProgramTestContext {
    let mut program_test = ProgramTest::new("amm_program", amm::ID, None);
    program_test.add_program("tensor_whitelist", tensor_whitelist::ID, None);
    program_test.start_with_context().await
}

pub async fn airdrop(
    context: &mut ProgramTestContext,
    receiver: &Pubkey,
    amount: u64,
) -> Result<(), BanksClientError> {
    let tx = Transaction::new_signed_with_payer(
        &[system_instruction::transfer(
            &context.payer.pubkey(),
            receiver,
            amount,
        )],
        Some(&context.payer.pubkey()),
        &[&context.payer],
        context.last_blockhash,
    );

    context.banks_client.process_transaction(tx).await.unwrap();
    Ok(())
}

pub struct TestWhitelist {
    pub authority: Pubkey,
    pub whitelist: Pubkey,
}

pub struct TestWhitelistInputs<'a> {
    pub owner: &'a Keypair,
    pub cosigner: &'a Keypair,
    pub identifier: [u8; 32],
}

pub async fn setup_default_whitelist<'a>(
    context: &mut ProgramTestContext,
    inputs: TestWhitelistInputs<'a>,
) -> TestWhitelist {
    let TestWhitelistInputs {
        owner,
        cosigner,
        identifier,
    } = inputs;

    // Create basic whitelist for testing.
    let whitelist_authority = Pubkey::find_program_address(&[], &tensor_whitelist::ID).0;
    let whitelist = Whitelist::find_pda(identifier).0;

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
        .uuid(identifier)
        .cosigner(cosigner.pubkey())
        .fvc(owner.pubkey())
        .name(identifier)
        .instruction();

    let tx = Transaction::new_signed_with_payer(
        &[ix1, ix2],
        Some(&context.payer.pubkey()),
        &[&context.payer, &owner, &cosigner],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    TestWhitelist {
        authority: whitelist_authority,
        whitelist,
    }
}

pub struct TestPool {
    pub pool: Pubkey,
    pub sol_escrow: Pubkey,
    pub identifier: Pubkey,
    pub config: PoolConfig,
}

pub struct TestPoolInputs<'a> {
    pub owner: &'a Keypair,
    pub cosigner: &'a Keypair,
    pub identifier: Pubkey,
    pub whitelist: Pubkey,
    pub pool_type: Option<PoolType>,
    pub curve_type: Option<CurveType>,
    pub starting_price: Option<u64>,
    pub delta: Option<u64>,
    pub mm_compound_fees: Option<bool>,
    pub mm_fee_bps: Option<u16>,
}

pub async fn setup_default_pool<'a>(
    context: &mut ProgramTestContext,
    inputs: TestPoolInputs<'a>,
) -> TestPool {
    let TestPoolInputs {
        owner,
        cosigner,
        identifier,
        whitelist,
        pool_type,
        curve_type,
        starting_price,
        delta,
        mm_compound_fees,
        mm_fee_bps,
    } = inputs;

    let pool = Pool::find_pda(&owner.pubkey(), &identifier).0;
    let sol_escrow = SolEscrow::find_pda(&pool).0;

    let config = PoolConfig {
        pool_type: pool_type.unwrap_or(PoolType::Token),
        curve_type: curve_type.unwrap_or(CurveType::Linear),
        starting_price: starting_price.unwrap_or(1),
        delta: delta.unwrap_or(1),
        mm_compound_fees: mm_compound_fees.unwrap_or(false),
        mm_fee_bps,
    };

    let ix = CreatePoolBuilder::new()
        .owner(owner.pubkey())
        .pool(pool)
        .sol_escrow(sol_escrow)
        .whitelist(whitelist)
        .identifier(identifier.to_bytes())
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

    TestPool {
        pool,
        sol_escrow,
        identifier,
        config,
    }
}
