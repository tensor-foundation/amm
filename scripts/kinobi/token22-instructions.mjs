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
        buyNftT22: {
          accounts: {
            tokenProgram: {
              defaultValue: k.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
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
            ),
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("transferHookAccounts"),
              {
                isOptional: false,
                isSigner: false,
                isWritable: false
              }
            )
          ]
        },
        depositNftT22: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            tokenProgram: {
              defaultValue: k.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
              )
            }
          },
          remainingAccounts: [
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("transferHookAccounts"),
              {
                isOptional: false,
                isSigner: false,
                isWritable: false
              }
            )
          ]
        },
        sellNftTradePoolT22: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            tokenProgram: {
              defaultValue: k.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
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
            ),
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("transferHookAccounts"),
              {
                isOptional: false,
                isSigner: false,
                isWritable: false
              }
            )
          ]
        },
        sellNftTokenPoolT22: {
          accounts: {
            whitelist: {
              isOptional: false
            },
            tokenProgram: {
              defaultValue: k.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
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
            ),
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("transferHookAccounts"),
              {
                isOptional: false,
                isSigner: false,
                isWritable: false
              }
            )
          ]
        },
        withdrawNftT22: {
          accounts: {
            tokenProgram: {
              defaultValue: k.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
              )
            }
          },
          remainingAccounts: [
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("transferHookAccounts"),
              {
                isOptional: false,
                isSigner: false,
                isWritable: false
              }
            )
          ]
        }
      })
    );

    return root;
  });
}
