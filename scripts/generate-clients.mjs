#!/usr/bin/env zx
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor as renderJavaScriptVisitor } from "@codama/renderers-js";
import { renderVisitor as renderRustVisitor } from "@codama/renderers-rust";
import * as c from "codama";
import "zx/globals";
import { getAllProgramIdls } from "./utils.mjs";

import coreInstructions from "./codama/core-instructions.mjs";
import legacyInstructions from "./codama/legacy-instructions.mjs";
import token22Instructions from "./codama/token22-instructions.mjs";

// Instanciate codama.
const [idl, ...additionalIdls] = getAllProgramIdls().map((idl) =>
  rootNodeFromAnchor(require(idl))
);
const codama = c.createFromRoot(idl, additionalIdls);

// Update programs.
codama.update(
  new c.updateProgramsVisitor({
    ammProgram: { name: "tensorAmm" }
  })
);

// Update accounts.
codama.update(
  c.updateAccountsVisitor({
    pool: {
      seeds: [
        c.constantPdaSeedNodeFromString("utf8", "pool"),
        c.variablePdaSeedNode(
          "owner",
          c.publicKeyTypeNode(),
          "The address of the pool owner"
        ),
        c.variablePdaSeedNode(
          "pool_id",
          c.fixedSizeTypeNode(c.bytesTypeNode(), 32),
          "Pool unique ID"
        )
      ]
    },
    nftDepositReceipt: {
      seeds: [
        c.constantPdaSeedNodeFromString("utf8", "nft_receipt"),
        c.variablePdaSeedNode(
          "mint",
          c.publicKeyTypeNode(),
          "The nft mint address"
        ),
        c.variablePdaSeedNode("pool", c.publicKeyTypeNode(), "The pool address")
      ]
    },
    assetDepositReceipt: {
      seeds: [
        c.constantPdaSeedNodeFromString("utf8", "nft_receipt"),
        c.variablePdaSeedNode(
          "asset",
          c.publicKeyTypeNode(),
          "The asset address"
        ),
        c.variablePdaSeedNode("pool", c.publicKeyTypeNode(), "The pool address")
      ]
    }
  })
);

// Update instructions.
codama.update(
  c.updateInstructionsVisitor({
    createPool: {
      accounts: {
        pool: {
          defaultValue: c.pdaValueNode("pool", [
            c.pdaSeedValueNode("owner", c.accountValueNode("owner")),
            c.pdaSeedValueNode("poolId", c.argumentValueNode("poolId"))
          ])
        }
      },
      arguments: {
        poolId: {
          defaultValue: c.resolverValueNode("resolvePoolIdOnCreate")
        },
        maxTakerSellCount: {
          defaultValue: c.noneValueNode()
        }
      }
    },
    editPool: {
      arguments: {
        maxTakerSellCount: {
          defaultValue: c.noneValueNode()
        }
      }
    }
  })
);

// Add missing types from the IDL.
codama.update(
  c.bottomUpTransformerVisitor([
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]sharedEscrow",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("nullableAddress", "hooked")
        };
      }
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]cosigner",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("nullableAddress", "hooked")
        };
      }
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]makerBroker",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("nullableAddress", "hooked")
        };
      }
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]takerBroker",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("nullableAddress", "hooked")
        };
      }
    },
    {
      select:
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]currency",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("currency", "hooked")
        };
      }
    },
    {
      select:
        "[definedTypeNode]poolConfig.[structTypeNode].[structFieldTypeNode]mmFeeBps",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("nullableU16", "hooked")
        };
      }
    },
    {
      select:
        "[definedTypeNode]editPoolConfig.[structTypeNode].[structFieldTypeNode]mmFeeBps",
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        return {
          ...node,
          type: c.definedTypeLinkNode("nullableU16", "hooked")
        };
      }
    }
  ])
);

// Set default account values accross multiple instructions.
codama.update(
  c.setInstructionAccountDefaultValuesVisitor([
    // default programs
    {
      account: "tokenProgram",
      ignoreIfOptional: true,
      defaultValue: c.publicKeyValueNode(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "tokenProgram"
      )
    },
    {
      account: "associatedTokenProgram",
      ignoreIfOptional: true,
      defaultValue: c.publicKeyValueNode(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        "associatedTokenProgram"
      )
    },
    {
      account: "ammProgram",
      ignoreIfOptional: true,
      defaultValue: c.publicKeyValueNode(
        "TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg",
        "ammProgram"
      )
    },
    {
      account: "systemProgram",
      ignoreIfOptional: true,
      defaultValue: c.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram"
      )
    },
    {
      account: "sysProgram",
      ignoreIfOptional: true,
      defaultValue: c.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram"
      )
    },
    {
      account: "nativeProgram",
      ignoreIfOptional: true,
      defaultValue: c.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram"
      )
    },
    {
      account: "escrowProgram",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolveEscrowProgramFromSharedEscrow",
        {
          dependsOn: [c.accountValueNode("sharedEscrow")]
        }
      )
    },
    // pNFT specific accounts
    {
      account: "tokenMetadataProgram",
      defaultValue: c.resolverValueNode(
        "resolveTokenMetadataProgramFromTokenStandard",
        {
          dependsOn: [c.argumentValueNode("tokenStandard")]
        }
      )
    },
    {
      account: "authorizationRulesProgram",
      defaultValue: c.resolverValueNode(
        "resolveAuthorizationRulesProgramFromTokenStandard",
        {
          dependsOn: [c.argumentValueNode("tokenStandard")]
        }
      )
    },
    {
      account: "sysvarInstructions",
      defaultValue: c.resolverValueNode(
        "resolveSysvarInstructionsFromTokenStandard",
        {
          dependsOn: [c.argumentValueNode("tokenStandard")]
        }
      )
    },
    // default accounts
    {
      account: "feeVault",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveFeeVaultPdaFromPool", {
        dependsOn: [c.accountValueNode("pool")]
      })
    },
    {
      account: "sourceTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveSourceAta", {
        dependsOn: [
          c.accountValueNode("source"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },

    {
      account: "destinationTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveDestinationAta", {
        dependsOn: [
          c.accountValueNode("destination"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "ownerTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveOwnerAta", {
        dependsOn: [
          c.accountValueNode("owner"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "buyerTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveBuyerAta", {
        dependsOn: [
          c.accountValueNode("buyer"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "sellerTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveSellerAta", {
        dependsOn: [
          c.accountValueNode("seller"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "takerTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveTakerAta", {
        dependsOn: [
          c.accountValueNode("taker"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "poolTa",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolvePoolAta", {
        dependsOn: [
          c.accountValueNode("pool"),
          c.accountValueNode("mint"),
          c.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "sourceTokenRecord ",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolveSourceTokenRecordFromTokenStandard",
        {
          dependsOn: [
            c.accountValueNode("mint"),
            c.accountValueNode("sourceTa")
          ]
        }
      )
    },
    {
      account: "destinationTokenRecord",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolveDestinationTokenRecordFromTokenStandard",
        {
          dependsOn: [
            c.accountValueNode("mint"),
            c.accountValueNode("destinationTa")
          ]
        }
      )
    },
    {
      account: "ownerTokenRecord",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolveOwnerTokenRecordFromTokenStandard",
        {
          dependsOn: [c.accountValueNode("mint"), c.accountValueNode("ownerTa")]
        }
      )
    },
    {
      account: "buyerTokenRecord",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolveBuyerTokenRecordFromTokenStandard",
        {
          dependsOn: [c.accountValueNode("mint"), c.accountValueNode("buyerTa")]
        }
      )
    },
    {
      account: "sellerTokenRecord",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolveSellerTokenRecordFromTokenStandard",
        {
          dependsOn: [
            c.accountValueNode("mint"),
            c.accountValueNode("sellerTa")
          ]
        }
      )
    },
    {
      account: "poolTokenRecord",
      ignoreIfOptional: false,
      defaultValue: c.resolverValueNode(
        "resolvePoolTokenRecordFromTokenStandard",
        {
          dependsOn: [c.accountValueNode("mint"), c.accountValueNode("poolTa")]
        }
      )
    },
    {
      account: "nftReceipt",
      ignoreIfOptional: true,
      defaultValue: c.pdaValueNode("nftDepositReceipt")
    },
    {
      account: "metadata",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveMetadata", {
        dependsOn: [c.accountValueNode("mint")]
      })
    },
    {
      account: "edition",
      ignoreIfOptional: true,
      defaultValue: c.resolverValueNode("resolveEditionFromTokenStandard", {
        dependsOn: [c.accountValueNode("mint")]
      })
    },
    {
      account: "rentPayer",
      ignoreIfOptional: true,
      defaultValue: c.accountValueNode("owner")
    }
  ])
);

// Set more struct default values dynamically.
codama.update(
  c.bottomUpTransformerVisitor([
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
          "optionalRoyaltyPct"
        ];
        return (
          c.isNode(node, ["instructionNode", "instructionArgumentNode"]) &&
          c.isNode(node.type, "optionTypeNode") &&
          names.includes(node.name)
        );
      },
      transform: (node) => {
        c.assertIsNode(node, ["instructionNode", "instructionArgumentNode"]);
        return {
          ...node,
          defaultValueStrategy: "optional",
          defaultValue: c.noneValueNode()
        };
      }
    }
  ])
);

// Update instructions using additional visitors.
codama.update(legacyInstructions());
codama.update(token22Instructions());
codama.update(coreInstructions());

// Debug: print the AST.
// codama.accept(c.consoleLogVisitor(c.getDebugStringVisitor({ indent: true })));

// Render JavaScript.
const jsClient = path.join(__dirname, "..", "clients", "js");
codama.accept(
  renderJavaScriptVisitor(path.join(jsClient, "src", "generated"), {
    prettier: require(path.join(jsClient, ".prettierrc.json")),
    dependencyMap: {
      resolvers: "@tensor-foundation/resolvers"
    },
    linkOverrides: {
      resolvers: {
        resolveSourceAta: '@tensor-foundation/resolvers',
        resolveDestinationAta: '@tensor-foundation/resolvers',
        resolveOwnerAta: '@tensor-foundation/resolvers', 
        resolveBuyerAta: '@tensor-foundation/resolvers',
        resolveSellerAta: '@tensor-foundation/resolvers',
        resolvePoolAta: '@tensor-foundation/resolvers',
        resolveSourceTokenRecordFromTokenStandard: '@tensor-foundation/resolvers',
        resolveDestinationTokenRecordFromTokenStandard: '@tensor-foundation/resolvers', 
        resolveOwnerTokenRecordFromTokenStandard: '@tensor-foundation/resolvers',
        resolveBuyerTokenRecordFromTokenStandard: '@tensor-foundation/resolvers',
        resolveSellerTokenRecordFromTokenStandard: '@tensor-foundation/resolvers',
        resolvePoolTokenRecordFromTokenStandard: '@tensor-foundation/resolvers',
        resolveMetadata: '@tensor-foundation/resolvers',
        resolveEditionFromTokenStandard: '@tensor-foundation/resolvers',
        resolveAuthorizationRulesProgramFromTokenStandard: '@tensor-foundation/resolvers',
        resolveTokenMetadataProgramFromTokenStandard: '@tensor-foundation/resolvers',
        resolveSysvarInstructionsFromTokenStandard: '@tensor-foundation/resolvers',
        resolveEscrowProgramFromSharedEscrow: '@tensor-foundation/resolvers'
      },
      definedTypes: {
        tokenStandard: '@tensor-foundation/mpl-token-metadata',
        nullableAddress: '../../hooked',
        currency: '../../hooked',
        nullableU16: '../../hooked'
      }
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
      "resolveEditionFromTokenStandard"
    ]
  })
);

// Render Rust.
const rustClient = path.join(__dirname, "..", "clients", "rust");
codama.accept(
  renderRustVisitor(path.join(rustClient, "src", "generated"), {
    formatCode: true,
    crateFolder: rustClient
  })
);
