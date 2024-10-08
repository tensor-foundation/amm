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
        buyNftCore: {
          accounts: {
            feeVault: {
              defaultValue: k.resolverValueNode("resolveFeeVaultPdaFromPool", {
                dependsOn: [k.accountValueNode("pool")]
              })
            },
            rentPayer: {
              defaultValue: k.accountValueNode("owner")
            },
            nftReceipt: {
              defaultValue: k.pdaValueNode("assetDepositReceipt")
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
        depositNftCore: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            nftReceipt: {
              defaultValue: k.pdaValueNode("assetDepositReceipt")
            }
          }
        },
        withdrawNftCore: {
          accounts: {
            nftReceipt: {
              defaultValue: k.pdaValueNode("assetDepositReceipt")
            }
          }
        },
        sellNftTokenPoolCore: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            feeVault: {
              defaultValue: k.resolverValueNode("resolveFeeVaultPdaFromPool", {
                dependsOn: [k.accountValueNode("pool")]
              })
            },
            rentPayer: {
              defaultValue: k.accountValueNode("owner")
            },
            nftReceipt: {
              defaultValue: k.pdaValueNode("assetDepositReceipt")
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
        sellNftTradePoolCore: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            feeVault: {
              defaultValue: k.resolverValueNode("resolveFeeVaultPdaFromPool", {
                dependsOn: [k.accountValueNode("pool")]
              })
            },
            rentPayer: {
              defaultValue: k.accountValueNode("owner")
            },
            nftReceipt: {
              defaultValue: k.pdaValueNode("assetDepositReceipt")
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
        }
      })
    );

    return root;
  });
}
