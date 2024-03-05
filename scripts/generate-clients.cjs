const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "program", "idl");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([
  path.join(idlDir, "project_name_program.json"),
]);

// Update programs.
kinobi.update(
  new k.updateProgramsVisitor({
    projectNameProgram: { name: "projectName" },
  })
);

// Update accounts.
kinobi.update(
  k.updateAccountsVisitor({
    myPdaAccount: {
      seeds: [
        k.constantPdaSeedNodeFromString("myPdaAccount"),
        k.programIdPdaSeedNode(),
        k.variablePdaSeedNode(
          "authority",
          k.publicKeyTypeNode(),
          "The address of the authority"
        ),
        k.variablePdaSeedNode(
          "name",
          k.stringTypeNode(),
          "The name of the account"
        ),
      ],
    },
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(k.renderJavaScriptExperimentalVisitor(jsDir, { prettier }));

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
kinobi.accept(
  k.renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  })
);
