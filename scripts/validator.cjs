const path = require("path");

const targetDir = path.join(__dirname, "..", "target");

function getProgram(programBinary) {
  return path.join(targetDir, "deploy", programBinary);
}

module.exports = {
  validator: {
    commitment: "processed",
    programs: [
      {
        label: "Amm",
        programId: "TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA",
        deployPath: getProgram("amm_program.so")
      },
      // Below are external programs that should be included in the local validator.
      // You may configure which ones to fetch from the cluster when building
      // programs within the `scripts/program/dump.sh` script.
      {
        label: "SPL Noop",
        programId: "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
        deployPath: getProgram("spl_noop.so")
      },
      {
        label: "Tensor Whitelist",
        programId: "TL1ST2iRBzuGTqLn1KXnGdSnEow62BzPnGiqyRXhWtW",
        // New version isn't deployed on-chain yet so we need to reference a local one.
        deployPath: path.join(
          __dirname,
          "..",
          "clients",
          "rust",
          "tests",
          "fixtures",
          "whitelist_program.so"
        )
      },
      {
        label: "Token Metadata",
        programId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        deployPath: getProgram("mpl_token_metadata.so")
      },
      {
        label: "Tensor Escrow",
        programId: "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN",
        deployPath: getProgram("escrow_program.so")
      }
    ]
  }
};
