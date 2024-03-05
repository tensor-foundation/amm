<h1 align="center">
  Anchor Project Template
</h1>
<p align="center">
  <img width="400" alt="Anchor Template" src="https://github.com/tensor-foundation/anchor-project-template/assets/729235/e4a818f8-b144-4347-a7df-9123c6fdd707" />
</p>

<p align="center">
  A template for Anchor-based programs with generated clients.
</p>

## Features

- **Generate IDLs** using [Anchor](https://github.com/coral-xyz/anchor) + [Shank](https://github.com/metaplex-foundation/shank)
- **Generate clients** for one or more programs using [Kinobi](https://github.com/metaplex-foundation/kinobi)
- Configure **local validators** using [Amman](https://github.com/metaplex-foundation/amman)
- **Build, test and lint** programs and clients using GitHub Actions.
- **Publish** your `web3.js 2.0` JavaScript client and its TypeScript documentation by dispatching a GitHub workflow.
- **Publish** your Rust client SDK to [crates.io](https://crates.io) by dispatching a GitHub workflow.

## Getting started

1. [Use this template](https://github.com/new?template_name=anchor-project-template&template_owner=tensor-foundation) to create a new repository.

2. Open the `setup.sh` script and update the following variables.
   ```sh
   NAME="project-name"
   ORGANIZATION="organization"
   AUTHOR="author <author@email.com>"
   DESCRIPTION="My project description"
   PUBLIC_KEY="MyProgram1111111111111111111111111111111111"
   ```
3. Run the `setup.sh` script to initialize the project. This will find/replace the variable above, rename some files/folders, update the README and, finally, remove the `setup.sh` script.
   ```bash
   ./setup.sh
   ```
4. [Read the `CONTRIBUTING.md` file](./CONTRIBUTING.md) to learn more about how to use the project.

## License

Copyright (c) 2024 Tensor Protocol Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
