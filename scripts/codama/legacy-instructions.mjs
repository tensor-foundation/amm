import * as c from "codama";

export default function visitor(options) {
  return c.rootNodeVisitor((currentRoot) => {
    let root = currentRoot;
    const updateRoot = (visitor) => {
      const newRoot = c.visit(root, visitor);
      c.assertIsNode(newRoot, "rootNode");
      root = newRoot;
    };

    updateRoot(
      c.updateInstructionsVisitor({
        buyNft: {
          accounts: {
            userTokenRecord: {
              isOptional: true,
              defaultValue: c.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    c.accountValueNode("mint"),
                    c.accountValueNode("takerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: c.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: c.enumValueNode(
                c.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          },
          remainingAccounts: [
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("creators"),
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
              defaultValue: c.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    c.accountValueNode("mint"),
                    c.accountValueNode("ownerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: c.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: c.enumValueNode(
                c.definedTypeLinkNode("TokenStandard", "resolvers"),
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
              defaultValue: c.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    c.accountValueNode("mint"),
                    c.accountValueNode("takerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: c.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: c.enumValueNode(
                c.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          },
          remainingAccounts: [
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("creators"),
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
              defaultValue: c.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    c.accountValueNode("mint"),
                    c.accountValueNode("takerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: c.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: c.enumValueNode(
                c.definedTypeLinkNode("TokenStandard", "resolvers"),
                "ProgrammableNonFungible"
              )
            }
          },
          remainingAccounts: [
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("creators"),
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
              defaultValue: c.resolverValueNode(
                "resolveUserTokenRecordFromTokenStandard",
                {
                  dependsOn: [
                    c.accountValueNode("mint"),
                    c.accountValueNode("ownerTa")
                  ]
                }
              )
            }
          },
          arguments: {
            tokenStandard: {
              type: c.definedTypeLinkNode("TokenStandard", "resolvers"),
              defaultValue: c.enumValueNode(
                c.definedTypeLinkNode("TokenStandard", "resolvers"),
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
