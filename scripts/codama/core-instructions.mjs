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
        buyNftCore: {
          accounts: {
            feeVault: {
              defaultValue: c.resolverValueNode("resolveFeeVaultPdaFromPool", {
                dependsOn: [c.accountValueNode("pool")]
              })
            },
            rentPayer: {
              defaultValue: c.accountValueNode("owner")
            },
            nftReceipt: {
              defaultValue: c.pdaValueNode("assetDepositReceipt")
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
        depositNftCore: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            nftReceipt: {
              defaultValue: c.pdaValueNode("assetDepositReceipt")
            }
          }
        },
        withdrawNftCore: {
          accounts: {
            nftReceipt: {
              defaultValue: c.pdaValueNode("assetDepositReceipt")
            }
          }
        },
        sellNftTokenPoolCore: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            feeVault: {
              defaultValue: c.resolverValueNode("resolveFeeVaultPdaFromPool", {
                dependsOn: [c.accountValueNode("pool")]
              })
            },
            rentPayer: {
              defaultValue: c.accountValueNode("owner")
            },
            nftReceipt: {
              defaultValue: c.pdaValueNode("assetDepositReceipt")
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
        sellNftTradePoolCore: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            feeVault: {
              defaultValue: c.resolverValueNode("resolveFeeVaultPdaFromPool", {
                dependsOn: [c.accountValueNode("pool")]
              })
            },
            rentPayer: {
              defaultValue: c.accountValueNode("owner")
            },
            nftReceipt: {
              defaultValue: c.pdaValueNode("assetDepositReceipt")
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
        }
      })
    );

    return root;
  });
}
