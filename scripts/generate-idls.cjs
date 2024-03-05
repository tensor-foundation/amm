const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "program", "idl");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..");

generateIdl({
  generator: "anchor",
  programName: "project_name_program",
  programId: "MyProgram1111111111111111111111111111111111",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "program"),
});
