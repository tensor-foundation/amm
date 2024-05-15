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
    ammProgram: { name: "tensorAmm" },
  }),
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
          "The address of the pool owner",
        ),
        k.variablePdaSeedNode(
          "pool_id",
          k.bytesTypeNode(k.fixedSizeNode(32)),
          "Pool unique ID",
        ),
      ],
    },
    sharedEscrow: {
      seeds: [
        k.constantPdaSeedNodeFromString("shared_escrow"),
        k.variablePdaSeedNode(
          "owner",
          k.publicKeyTypeNode(),
          "The owner address",
        ),
        k.variablePdaSeedNode(
          "nr",
          k.numberTypeNode("u16"),
          "The escrow number",
        ),
      ],
    },
    nftDepositReceipt: {
      seeds: [
        k.constantPdaSeedNodeFromString("nft_receipt"),
        k.variablePdaSeedNode(
          "mint",
          k.publicKeyTypeNode(),
          "The nft mint address",
        ),
        k.variablePdaSeedNode(
          "pool",
          k.publicKeyTypeNode(),
          "The pool address",
        ),
      ],
    },
  }),
);

// Update instructions.
kinobi.update(
  k.updateInstructionsVisitor({
    depositNft: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible",
          ),
        },
      },
    },
    withdrawNft: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible",
          ),
        },
      },
    },
    sellNftTokenPool: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible",
          ),
        },
      },
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true,
        }),
      ],
    },
    sellNftTradePool: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible",
          ),
        },
      },
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true,
        }),
      ],
    },
    buyNft: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible",
          ),
        },
      },
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true,
        }),
      ],
    },
  }),
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
          type: k.definedTypeLinkNode("nullableAddress", "hooked"),
        };
      },
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]cosigner",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableAddress", "hooked"),
        };
      },
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]makerBroker",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableAddress", "hooked"),
        };
      },
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]takerBroker",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableAddress", "hooked"),
        };
      },
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]currency",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("currency", "hooked"),
        };
      },
    },
    {
      select:
        "[definedTypeNode]poolConfig.[structTypeNode].[structFieldTypeNode]mmFeeBps",
      transform: (node) => {
        k.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: k.definedTypeLinkNode("nullableU16", "hooked"),
        };
      },
    },
  ]),
);

// Set default account values accross multiple instructions.
kinobi.update(
  k.setInstructionAccountDefaultValuesVisitor([
    // default programs
    {
      account: "tokenProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "tokenProgram",
      ),
    },
    {
      account: "associatedTokenProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        "associatedTokenProgram",
      ),
    },
    {
      account: "ammProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA",
        "ammProgram",
      ),
    },
    {
      account: "systemProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram",
      ),
    },
    {
      account: "tokenMetadataProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        "tokenMetadataProgram",
      ),
    },
    {
      account: "authorizationRulesProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg",
        "authorizationRulesProgram",
      ),
    },
    {
      account: "sysvarInstructions",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "Sysvar1111111111111111111111111111111111111",
        "sysvarInstructions",
      ),
    },
    // default accounts
    {
      account: "feeVault",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveFeeVaultPdaFromPool", {
        dependsOn: [k.accountValueNode("pool")],
      }),
    },
    {
      account: "ownerAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveOwnerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("owner"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },
    {
      account: "buyerAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveBuyerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("buyer"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },
    {
      account: "sellerAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveSellerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("seller"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },
    {
      account: "poolAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolvePoolAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("pool"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },
    {
      account: "ownerTokenRecord",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode(
        "resolveOwnerTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("ownerAta"),
          ],
        },
      ),
    },
    {
      account: "buyerTokenRecord",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode(
        "resolveBuyerTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("buyerAta"),
          ],
        },
      ),
    },
    {
      account: "sellerTokenRecord",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode(
        "resolveSellerTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("sellerAta"),
          ],
        },
      ),
    },
    {
      account: "poolTokenRecord",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode(
        "resolvePoolTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("poolAta"),
          ],
        },
      ),
    },
    {
      account: "nftReceipt",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveNftReceipt", {
        importFrom: "resolvers",
        dependsOn: [k.accountValueNode("mint"), k.accountValueNode("pool")],
      }),
    },
    {
      account: "metadata",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveMetadata", {
        importFrom: "resolvers",
        dependsOn: [k.accountValueNode("mint")],
      }),
    },
    {
      account: "edition",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveEditionFromTokenStandard", {
        importFrom: "resolvers",
        dependsOn: [k.accountValueNode("mint")],
      }),
    },
    {
      account: "rentPayer",
      ignoreIfOptional: true,
      defaultValue: k.accountValueNode("owner"),
    },
  ]),
);

// Debug: print the AST.
// kinobi.accept(k.consoleLogVisitor(k.getDebugStringVisitor({ indent: true })));

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(
  new k.renderJavaScriptExperimentalVisitor(jsDir, {
    prettier,
    dependencyMap: {
      resolvers: "@tensor-foundation/resolvers",
    },
    asyncResolvers: [
      "resolveFeeVaultPdaFromPool",
      "resolveOwnerAta",
      "resolveBuyerAta",
      "resolveSellerAta",
      "resolvePoolAta",
      "resolveOwnerTokenRecordFromTokenStandard",
      "resolveBuyerTokenRecordFromTokenStandard",
      "resolveSellerTokenRecordFromTokenStandard",
      "resolvePoolTokenRecordFromTokenStandard",
      "resolveNftReceipt",
      "resolveMetadata",
      "resolveEditionFromTokenStandard",
    ],
  }),
);

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
kinobi.accept(
  k.renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  }),
);
