import * as k from "kinobi";

export default function visitor(options) {
  return k.rootNodeVisitor((currentRoot) => {
    let root = currentRoot;
    const updateRoot = (visitor) => {
      const newRoot = k.visit(root, visitor);
      k.assertIsNode(newRoot, "rootNode");
      root = newRoot;
    };

    updateRoot(
      k.updateInstructionsVisitor({
        buyNft: {
          accounts: {
            userTokenRecord: {
              isOptional: true,
              defaultValue: k.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    k.accountValueNode("mint"),
                    k.accountValueNode("takerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: k.enumValueNode(
                k.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          },
          remainingAccounts: [
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("creators"),
              {
                isOptional: true,
                isSigner: false,
                isWritable: true
              }
            )
          ]
        },
        depositNft: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            userTokenRecord: {
              isOptional: true,
              defaultValue: k.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    k.accountValueNode("mint"),
                    k.accountValueNode("ownerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: k.enumValueNode(
                k.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          }
        },
        sellNftTokenPool: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            userTokenRecord: {
              isOptional: true,
              defaultValue: k.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    k.accountValueNode("mint"),
                    k.accountValueNode("takerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: k.enumValueNode(
                k.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          },
          remainingAccounts: [
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("creators"),
              {
                isOptional: true,
                isSigner: false,
                isWritable: true
              }
            )
          ]
        },
        sellNftTradePool: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            userTokenRecord: {
              isOptional: true,
              defaultValue: k.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    k.accountValueNode("mint"),
                    k.accountValueNode("takerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: k.enumValueNode(
                k.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          },
          remainingAccounts: [
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("creators"),
              {
                isOptional: true,
                isSigner: false,
                isWritable: true
              }
            )
          ]
        },
        withdrawNft: {
          accounts: {
            userTokenRecord: {
              isOptional: true,
              defaultValue: k.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    k.accountValueNode("mint"),
                    k.accountValueNode("ownerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: k.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: k.enumValueNode(
                k.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          }
        }
      })
    );

    return root;
  });
}
