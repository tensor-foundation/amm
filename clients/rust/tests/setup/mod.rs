use solana_program_test::{BanksClientError, ProgramTest, ProgramTestContext};
use solana_sdk::{pubkey::Pubkey, signer::Signer, system_instruction, transaction::Transaction};

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
