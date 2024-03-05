const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "program", "idl");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..");

generateIdl({
  generator: "anchor",
  programName: "amm_program",
  programId: "TAMMqgJYcquwwj2tCdNUerh4C2bJjmghijVziSEf5tA",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "program"),
});
