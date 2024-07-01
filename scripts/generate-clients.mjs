#!/usr/bin/env zx
import "zx/globals";
import * as k from "kinobi";
import { rootNodeFromAnchor } from "@kinobi-so/nodes-from-anchor";
import { renderVisitor as renderJavaScriptVisitor } from "@kinobi-so/renderers-js";
import { renderVisitor as renderRustVisitor } from "@kinobi-so/renderers-rust";
import { getAllProgramIdls } from "./utils.mjs";

// Instanciate Kinobi.
const [idl, ...additionalIdls] = getAllProgramIdls().map((idl) =>
  rootNodeFromAnchor(require(idl))
);
const kinobi = k.createFromRoot(idl, additionalIdls);

// Update programs.
kinobi.update(
  new k.updateProgramsVisitor({
    ammProgram: { name: "tensorAmm" }
  })
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
          "The address of the pool owner"
        ),
        k.variablePdaSeedNode(
          "pool_id",
          k.fixedSizeTypeNode(k.bytesTypeNode(), 32),
          "Pool unique ID",
        ),
      ],
    },
    sharedEscrow: {
      seeds: [
        k.constantPdaSeedNodeFromString("utf8", "shared_escrow"),
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
        k.constantPdaSeedNodeFromString("utf8", "nft_receipt"),
        k.variablePdaSeedNode(
          "mint",
          k.publicKeyTypeNode(),
          "The nft mint address"
        ),
        k.variablePdaSeedNode("pool", k.publicKeyTypeNode(), "The pool address")
      ]
    }
  })
);

// Update instructions.
kinobi.update(
  k.updateInstructionsVisitor({
    createPool: {
      accounts: {
        pool: {
          defaultValue: k.pdaValueNode("pool", [
            k.pdaSeedValueNode("owner", k.accountValueNode("owner")),
            k.pdaSeedValueNode("poolId", k.argumentValueNode("poolId"))
          ])
        }
      },
      arguments: {
        poolId: {
          defaultValue: k.resolverValueNode("resolvePoolIdOnCreate"),
        },
        orderType: {
          defaultValue: k.numberValueNode(0),
        },
        maxTakerSellCount: {
          defaultValue: k.noneValueNode(),
        }
      }
    },
    depositNft: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible"
          )
        }
      }
    },
    withdrawNft: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible"
          )
        }
      }
    },
    sellNftTokenPool: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible"
          )
        }
      },
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true
        })
      ]
    },
    sellNftTradePool: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible"
          )
        }
      },
      remainingAccounts: [
        k.instructionRemainingAccountsNode(k.argumentValueNode("creators"), {
          isOptional: true,
          isSigner: false,
          isWritable: true
        })
      ]
    },
    buyNft: {
      arguments: {
        tokenStandard: {
          type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
          defaultValue: k.enumValueNode(
            k.definedTypeLinkNode("TokenStandard", "resolvers"),
            "NonFungible"
          )
        }
      },
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
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]makerBroker",
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
        "[accountNode]pool.[structTypeNode].[structFieldTypeNode]takerBroker",
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

// Set default account values accross multiple instructions.
kinobi.update(
  k.setInstructionAccountDefaultValuesVisitor([
    // default programs
    {
      account: "tokenProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "tokenProgram"
      )
    },
    {
      account: "associatedTokenProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        "associatedTokenProgram"
      )
    },
    {
      account: "ammProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA",
        "ammProgram"
      )
    },
    {
      account: "systemProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "11111111111111111111111111111111",
        "systemProgram"
      )
    },
    // pNFT specific accounts
    {
      account: "tokenMetadataProgram",
      defaultValue: k.resolverValueNode(
        "resolveTokenMetadataProgramFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.argumentValueNode("tokenStandard")]
        }
      )
    },
    {
      account: "authorizationRulesProgram",
      defaultValue: k.resolverValueNode(
        "resolveAuthorizationRulesProgramFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.argumentValueNode("tokenStandard")]
        }
      )
    },
    {
      account: "sysvarInstructions",
      defaultValue: k.resolverValueNode(
        "resolveSysvarInstructionsFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.argumentValueNode("tokenStandard")]
        }
      )
    },
    // default accounts
    {
      account: "feeVault",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveFeeVaultPdaFromPool", {
        dependsOn: [k.accountValueNode("pool")]
      })
    },
    {
      account: "ownerTa",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode("resolveOwnerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("owner"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "sellerTa",
      ignoreIfOptional: false,
      defaultValue: k.resolverValueNode("resolveSellerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("owner"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "ownerAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveOwnerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("owner"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "buyerAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveBuyerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("buyer"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "sellerAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveSellerAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("seller"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram")
        ]
      })
    },
    {
      account: "poolAta",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolvePoolAta", {
        importFrom: "resolvers",
        dependsOn: [
          k.accountValueNode("pool"),
          k.accountValueNode("mint"),
          k.accountValueNode("tokenProgram")
        ]
      })
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
            k.accountValueNode("ownerAta")
          ]
        }
      )
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
            k.accountValueNode("buyerAta")
          ]
        }
      )
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
            k.accountValueNode("sellerAta")
          ]
        }
      )
    },
    {
      account: "poolTokenRecord",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode(
        "resolvePoolTokenRecordFromTokenStandard",
        {
          importFrom: "resolvers",
          dependsOn: [k.accountValueNode("mint"), k.accountValueNode("poolAta")]
        }
      )
    },
    {
      account: "nftReceipt",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolvePoolNftReceipt", {
        importFrom: "resolvers",
        dependsOn: [k.accountValueNode("mint"), k.accountValueNode("pool")]
      })
    },
    {
      account: "metadata",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveMetadata", {
        importFrom: "resolvers",
        dependsOn: [k.accountValueNode("mint")]
      })
    },
    {
      account: "edition",
      ignoreIfOptional: true,
      defaultValue: k.resolverValueNode("resolveEditionFromTokenStandard", {
        importFrom: "resolvers",
        dependsOn: [k.accountValueNode("mint")]
      })
    },
    {
      account: "rentPayer",
      ignoreIfOptional: true,
      defaultValue: k.accountValueNode("owner")
    }
  ])
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
          "optionalRoyaltyPct"
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
          defaultValue: k.noneValueNode()
        };
      }
    }
  ])
);

// Debug: print the AST.
// kinobi.accept(k.consoleLogVisitor(k.getDebugStringVisitor({ indent: true })));

// Render JavaScript.
const jsClient = path.join(__dirname, "..", "clients", "js");
kinobi.accept(
  renderJavaScriptVisitor(path.join(jsClient, "src", "generated"), {
    prettier: require(path.join(jsClient, ".prettierrc.json")),
    dependencyMap: {
      resolvers: "@tensor-foundation/resolvers"
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
      "resolvePoolNftReceipt",
      "resolveMetadata",
      "resolveEditionFromTokenStandard"
    ]
  })
);

// Render Rust.
const rustClient = path.join(__dirname, "..", "clients", "rust");
kinobi.accept(
  renderRustVisitor(path.join(rustClient, "src", "generated"), {
    formatCode: true,
    crateFolder: rustClient,
  }),
);
