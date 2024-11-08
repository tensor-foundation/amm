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
        buyNftT22: {
          accounts: {
            tokenProgram: {
              defaultValue: c.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
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
            ),
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("transferHookAccounts"),
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
              defaultValue: c.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
              )
            }
          },
          remainingAccounts: [
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("transferHookAccounts"),
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
              defaultValue: c.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
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
            ),
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("transferHookAccounts"),
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
              defaultValue: c.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
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
            ),
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("transferHookAccounts"),
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
              defaultValue: c.publicKeyValueNode(
                "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                "tokenProgram"
              )
            }
          },
          remainingAccounts: [
            c.instructionRemainingAccountsNode(
              c.argumentValueNode("transferHookAccounts"),
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
