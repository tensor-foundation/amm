#!/usr/bin/env zx
import "zx/globals";
import * as k from "kinobi";
import { rootNodeFromAnchor } from "@kinobi-so/nodes-from-anchor";
import { renderVisitor as renderJavaScriptVisitor } from "@kinobi-so/renderers-js";
import { renderVisitor as renderRustVisitor } from "@kinobi-so/renderers-rust";
import { getAllProgramIdls } from "./utils.mjs";

import legacyInstructions from "./kinobi/legacy-instructions.mjs";
import token22Instructions from "./kinobi/token22-instructions.mjs";
import coreInstructions from "./kinobi/core-instructions.mjs";

// Instanciate Kinobi.
const [idl, ...additionalIdls] = getAllProgramIdls().map((idl) =>
  rootNodeFromAnchor(require(idl)),
);
const kinobi = k.createFromRoot(idl, additionalIdls);

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
        k.constantPdaSeedNodeFromString("utf8", "pool"),
        k.variablePdaSeedNode(
          "owner",
          k.publicKeyTypeNode(),
          "The address of the pool owner",
        ),
        k.variablePdaSeedNode(
          "pool_id",
          k.fixedSizeTypeNode(k.bytesTypeNode(), 32),
          "Pool unique ID",
        ),
      ],
    },
    // sharedEscrow: {
    //   seeds: [
    //     k.constantPdaSeedNodeFromString("utf8", "shared_escrow"),
    //     k.variablePdaSeedNode(
    //       "owner",
    //       k.publicKeyTypeNode(),
    //       "The owner address"
    //     ),
    //     k.variablePdaSeedNode(
    //       "nr",
    //       k.numberTypeNode("u16"),
    //       "The escrow number"
    //     )
    //   ]
    // },
    nftDepositReceipt: {
      seeds: [
        k.constantPdaSeedNodeFromString("utf8", "nft_receipt"),
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
    assetDepositReceipt: {
      seeds: [
        k.constantPdaSeedNodeFromString("utf8", "nft_receipt"),
        k.variablePdaSeedNode(
          "asset",
          k.publicKeyTypeNode(),
          "The asset address",
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
    createPool: {
      accounts: {
        pool: {
          defaultValue: k.pdaValueNode("pool", [
            k.pdaSeedValueNode("owner", k.accountValueNode("owner")),
            k.pdaSeedValueNode("poolId", k.argumentValueNode("poolId")),
          ]),
        },
      },
      arguments: {
        poolId: {
          defaultValue: k.resolverValueNode("resolvePoolIdOnCreate"),
        },
        maxTakerSellCount: {
          defaultValue: k.noneValueNode(),
        },
      },
    },
    editPool: {
      arguments: {
        maxTakerSellCount: {
          defaultValue: k.noneValueNode(),
        },
      },
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
        "TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg",
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
      account: "sysProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram",
      ),
    },
    {
      account: "nativeProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram",
      ),
    },
    // pNFT specific accounts
    {
      account: "tokenMetadataProgram",
      defaultValue: k.resolverValueNode(
        "resolveTokenMetadataProgramFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.argumentValueNode("tokenStandard")],
        },
      ),
    },
    {
      account: "authorizationRulesProgram",
      defaultValue: k.resolverValueNode(
        "resolveAuthorizationRulesProgramFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.argumentValueNode("tokenStandard")],
        },
      ),
    },
    {
      account: "sysvarInstructions",
      defaultValue: k.resolverValueNode(
        "resolveSysvarInstructionsFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.argumentValueNode("tokenStandard")],
        },
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
      account: "sourceTa",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveSourceAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("source"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },

    {
      account: "destinationTa",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveDestinationAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("destination"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },
    {
      account: "ownerTa",
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
      account: "buyerTa",
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
      account: "sellerTa",
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
      account: "takerTa",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveTakerAta", {
        dependsOn: [
          k.accountValueNode("taker"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram"),
        ],
      }),
    },
    {
      account: "poolTa",
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
      account: "sourceTokenRecord ",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode(
        "resolveSourceTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("sourceTa"),
          ],
        },
      ),
    },
    {
      account: "destinationTokenRecord",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode(
        "resolveDestinationTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("destinationTa"),
          ],
        },
      ),
    },
    {
      account: "ownerTokenRecord",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode(
        "resolveOwnerTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("ownerTa"),
          ],
        },
      ),
    },
    {
      account: "buyerTokenRecord",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode(
        "resolveBuyerTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("buyerTa"),
          ],
        },
      ),
    },
    {
      account: "sellerTokenRecord",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode(
        "resolveSellerTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [
            k.accountValueNode("mint"),
            k.accountValueNode("sellerTa"),
          ],
        },
      ),
    },
    {
      account: "poolTokenRecord",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode(
        "resolvePoolTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.accountValueNode("mint"), k.accountValueNode("poolTa")],
        },
      ),
    },
    {
      account: "nftReceipt",
      ignoreIfOptional: true,
      defaultValue: k.pdaValueNode("nftDepositReceipt"),
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

// Set more struct default values dynamically.
kinobi.update(
  k.bottomUpTransformerVisitor([
    {
      select: (node) => {
        const names = [
          "cosigner",
          "sharedEscrow",
          "makerBroker",
          "expireInSec",
          "max_taker_sell_count",
          "currency",
          "authorizationData",
          "optionalRoyaltyPct",
        ];
        return (
          k.isNode(node, ["instructionNode", "instructionArgumentNode"]) &&
          k.isNode(node.type, "optionTypeNode") &&
          names.includes(node.name)
        );
      },
      transform: (node) => {
        k.assertIsNode(node, ["instructionNode", "instructionArgumentNode"]);
        return {
          ...node,
          defaultValueStrategy: "optional",
          defaultValue: k.noneValueNode(),
        };
      },
    },
  ]),
);

// Update instructions using additional visitors.
kinobi.update(legacyInstructions());
kinobi.update(token22Instructions());
kinobi.update(coreInstructions());

// Debug: print the AST.
// kinobi.accept(k.consoleLogVisitor(k.getDebugStringVisitor({ indent: true })));

// Render JavaScript.
const jsClient = path.join(__dirname, "..", "clients", "js");
kinobi.accept(
  renderJavaScriptVisitor(path.join(jsClient, "src", "generated"), {
    prettier: require(path.join(jsClient, ".prettierrc.json")),
    dependencyMap: {
      resolvers: "@tensor-foundation/resolvers",
    },
    asyncResolvers: [
      "resolveFeeVaultPdaFromPool",
      "resolveOwnerAta",
      "resolveBuyerAta",
      "resolveSellerAta",
      "resolveTakerAta",
      "resolvePoolAta",
      "resolveSourceAta",
      "resolveDestinationAta",
      "resolveSourceTokenRecordFromTokenStandard",
      "resolveDestinationTokenRecordFromTokenStandard",
      "resolveOwnerTokenRecordFromTokenStandard",
      "resolveBuyerTokenRecordFromTokenStandard",
      "resolveSellerTokenRecordFromTokenStandard",
      "resolveUserTokenRecordFromTokenStandard",
      "resolvePoolTokenRecordFromTokenStandard",
      "resolvePoolNftReceipt",
      "resolveMetadata",
      "resolveEditionFromTokenStandard",
    ],
  }),
);

// Render Rust.
const rustClient = path.join(__dirname, "..", "clients", "rust");
kinobi.accept(
  renderRustVisitor(path.join(rustClient, "src", "generated"), {
    formatCode: true,
    crateFolder: rustClient,
  }),
);
