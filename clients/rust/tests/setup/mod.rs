use amm::{
    accounts::Pool,
    instructions::CreatePoolBuilder,
    types::{CurveType, PoolConfig, PoolType},
};
use solana_program_test::{BanksClientError, ProgramTest, ProgramTestContext};
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use tensor_whitelist::{
    accounts::WhitelistV2,
    instructions::CreateWhitelistV2Builder,
    types::{Condition, Mode},
};

pub const ONE_SOL_LAMPORTS: u64 = 1_000_000_000;

lazy_static::lazy_static! {
    pub static ref TEST_OWNER: Keypair = Keypair::new();
}

pub async fn program_context() -> ProgramTestContext {
    let mut program_test = ProgramTest::new("amm_program", amm::ID, None);
    program_test.add_program("whitelist_program", tensor_whitelist::ID, None);
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

pub struct TestWhitelistV2 {
    pub whitelist: Pubkey,
    pub update_authority: Pubkey,
    pub namespace: Pubkey,
    pub uuid: [u8; 32],
}

#[derive(Debug)]
pub struct TestWhitelistV2Inputs<'a> {
    pub update_authority_signer: &'a Keypair,
    pub namespace_signer: Option<&'a Keypair>,
    pub uuid: Option<[u8; 32]>,
    pub conditions: Option<Vec<Condition>>,
}

impl Default for TestWhitelistV2Inputs<'_> {
    fn default() -> Self {
        Self {
            update_authority_signer: &TEST_OWNER,
            namespace_signer: None,
            uuid: None,
            conditions: None,
        }
    }
}

pub async fn setup_default_whitelist<'a>(
    context: &mut ProgramTestContext,
    inputs: TestWhitelistV2Inputs<'a>,
) -> TestWhitelistV2 {
    let TestWhitelistV2Inputs {
        update_authority_signer,
        namespace_signer,
        uuid,
        conditions,
    } = inputs;

    let namespace_signer = namespace_signer.unwrap_or(update_authority_signer);
    let namespace = namespace_signer.pubkey();
    let uuid = uuid.unwrap_or([0u8; 32]);
    let update_authority = update_authority_signer.pubkey();

    // Create basic whitelist for testing.
    let whitelist = WhitelistV2::find_pda(&namespace, uuid).0;

    let conditions = conditions.unwrap_or(vec![Condition {
        mode: Mode::FVC,
        value: TEST_OWNER.pubkey(),
    }]);

    // Create the whitelist.
    let ix = CreateWhitelistV2Builder::new()
        .payer(update_authority)
        .update_authority(update_authority)
        .whitelist(whitelist)
        .uuid(uuid)
        .namespace(namespace)
        .conditions(conditions)
        .instruction();

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &update_authority_signer, &namespace_signer],
        context.last_blockhash,
    );
    context.banks_client.process_transaction(tx).await.unwrap();

    TestWhitelistV2 {
        whitelist,
        update_authority,
        namespace,
        uuid,
    }
}

pub struct TestPool {
    pub pool: Pubkey,
    pub identifier: Pubkey,
    pub config: PoolConfig,
}

#[derive(Debug)]
pub struct TestPoolInputs<'a> {
    pub owner: &'a Keypair,
    pub identifier: Pubkey,
    pub whitelist: Pubkey,
    pub pool_type: Option<PoolType>,
    pub curve_type: Option<CurveType>,
    pub starting_price: Option<u64>,
    pub delta: Option<u64>,
    pub mm_compound_fees: Option<bool>,
    pub mm_fee_bps: Option<u16>,
}

impl<'a> Default for TestPoolInputs<'a> {
    fn default() -> Self {
        Self {
            owner: &TEST_OWNER,
            identifier: Pubkey::new_unique(),
            whitelist: Pubkey::new_unique(),
            pool_type: None,
            curve_type: None,
            starting_price: None,
            delta: None,
            mm_compound_fees: None,
            mm_fee_bps: None,
        }
    }
}

pub async fn setup_default_pool<'a>(
    context: &mut ProgramTestContext,
    inputs: TestPoolInputs<'a>,
) -> TestPool {
    let TestPoolInputs {
        owner,
        identifier,
        whitelist,
        pool_type,
        curve_type,
        starting_price,
        delta,
        mm_compound_fees,
        mm_fee_bps,
    } = inputs;

    let pool = Pool::find_pda(&owner.pubkey(), identifier.to_bytes()).0;
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
        .whitelist(whitelist)
        .identifier(identifier.to_bytes())
        .config(config.clone())
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
        identifier,
        config,
    }
}
