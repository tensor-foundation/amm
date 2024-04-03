const fs = require("fs");
const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "program", "idl");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([path.join(idlDir, "amm_program.json")]);

// Update programs.
kinobi.update(
  new k.updateProgramsVisitor({
    ammProgram: { name: "amm" }
  })
);

// Update accounts.
kinobi.update(
  k.updateAccountsVisitor({
    pool: {
      seeds: [
        k.constantPdaSeedNodeFromString("pool"),
        k.variablePdaSeedNode(
          "owner",
          k.publicKeyTypeNode(),
          "The address of the pool owner"
        ),
        k.variablePdaSeedNode(
          "identifier",
          k.bytesTypeNode(k.fixedSizeNode(32)),
          "Pool unique identifier"
        )
      ]
    },
    solEscrow: {
      seeds: [
        k.constantPdaSeedNodeFromString("sol_escrow"),
        k.variablePdaSeedNode(
          "pool",
          k.publicKeyTypeNode(),
          "The address of the pool"
        )
      ]
    },
    escrowOwner: {
      seeds: [
        k.constantPdaSeedNodeFromString("nft_owner"),
        k.variablePdaSeedNode(
          "mint",
          k.publicKeyTypeNode(),
          "The nft mint address"
        )
      ]
    },
    escrowTokenAccount: {
      seeds: [
        k.constantPdaSeedNodeFromString("nft_escrow"),
        k.variablePdaSeedNode(
          "mint",
          k.publicKeyTypeNode(),
          "The nft mint address"
        )
      ]
    },
    nftDepositReceipt: {
      seeds: [
        k.constantPdaSeedNodeFromString("nft_receipt"),
        k.variablePdaSeedNode(
          "mint",
          k.publicKeyTypeNode(),
          "The nft mint address"
        )
      ]
    }
  })
);

// Update instructions.
kinobi.update(
  k.updateInstructionsVisitor({
    sellNftTokenPool: {
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true
        })
      ]
    }
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(k.renderJavaScriptExperimentalVisitor(jsDir, { prettier }));

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
kinobi.accept(
  k.renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir
  })
);
