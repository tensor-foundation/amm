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
          "pool_id",
          k.bytesTypeNode(k.fixedSizeNode(32)),
          "Pool unique ID"
        )
      ]
    },
    sharedEscrow: {
      seeds: [
        k.constantPdaSeedNodeFromString("shared_escrow"),
        k.variablePdaSeedNode(
          "owner",
          k.publicKeyTypeNode(),
          "The owner address"
        ),
        k.variablePdaSeedNode(
          "nr",
          k.numberTypeNode("u16"),
          "The escrow number"
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
        ),
        k.variablePdaSeedNode("pool", k.publicKeyTypeNode(), "The pool address")
      ]
    },
    feeVault: {
      seeds: [
        k.constantPdaSeedNodeFromString("fee_vault"),
        k.variablePdaSeedNode(
          "index",
          k.bytesTypeNode(k.fixedSizeNode(1)),
          "The fee vault index"
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
    },
    sellNftTradePool: {
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true
        })
      ]
    },
    buyNft: {
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true
        })
      ]
    },
    feeCrank: {
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("feeAccounts"), {
          isOptional: false,
          isSigner: false,
          isWritable: true
        })
      ]
    }
  })
);

// Add missing types from the IDL.
kinobi.update(
  k.bottomUpTransformerVisitor([
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]sharedEscrow",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableAddress", "hooked")
        };
      }
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]cosigner",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableAddress", "hooked")
        };
      }
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]currency",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("currency", "hooked")
        };
      }
    },
    {
      select:
        "[definedTypeNode]poolConfig.[structTypeNode].[structFieldTypeNode]mmFeeBps",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableU16", "hooked")
        };
      }
    }
  ])
);

// Debug: print the AST.
// kinobi.accept(k.consoleLogVisitor(k.getDebugStringVisitor({ indent: true })));

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(
  new k.renderJavaScriptExperimentalVisitor(jsDir, {
    prettier
  })
);

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
kinobi.accept(
  k.renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir
  })
);
