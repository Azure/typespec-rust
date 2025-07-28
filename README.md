# TypeSpec Rust Emitter

## Development

### Prerequisites

- Node.js 20 or later
- pnpm 10.x
- Rust toolchain (managed via `rust-toolchain.toml`)

### Setup

```bash
cd packages/typespec-rust
pnpm install
```

### Code Formatting

This project enforces code formatting for all source files. The CI pipeline will check that all code follows the defined formatting rules.

#### Supported File Types

- **TypeScript/JavaScript**: Formatted using ESLint with automatic fixes
- **Markdown/JSON**: Formatted using Prettier
- **Rust**: Formatted using rustfmt
- **TypeSpec**: Currently validated for syntax (formatting tools not yet available)

#### Local Development Scripts

From the repository root:

```bash
# Check formatting for all file types
./scripts/check-all-formats.sh

# Format all files automatically
./scripts/format-all.sh

# Check individual file types
./scripts/check-rust-format.sh
./scripts/check-typespec-format.sh
```

From the `packages/typespec-rust` directory:

```bash
# Format TypeScript and run ESLint
pnpm run format

# Check formatting without making changes
pnpm run format:check

# Format specific file types
pnpm run format:prettier    # Markdown, JSON, TypeScript
pnpm run format:eslint      # TypeScript/JavaScript with ESLint
```

#### CI Pipeline

The GitHub Actions workflow automatically checks formatting on all pull requests and pushes to main/master branches. All checks must pass before code can be merged.

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit <https://cla.opensource.microsoft.com>.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
