# TypeSpec Rust Generator

The TypeSpec Rust generator is intended to be used with the TypeSpec compiler.
Generated crates should forward their `default` feature to `azure_core/default`
by setting `default = ["azure_core/default"]` in the `[features]` section of
`Cargo.toml`. Declare the `azure_core` dependency with `default-features = false`,
including in `[workspace.dependencies]` when inherited from a workspace.
Together, these settings enable the default HTTP transport while allowing callers
to disable it with `--no-default-features`.

## Azure Resource Manager

Resource Manager services are detected from TypeSpec metadata; no mode or flavor
option is required. Use the `azure_resourcemanager_<service>` crate naming
convention. The common `api-version` emitter option selects the service version:

```yaml
options:
  "@azure-tools/typespec-rust":
    crate-name: azure_resourcemanager_keyvault
    api-version: "2026-05-15"
```

Generated manifests inherit workspace package metadata, including `exclude`,
and workspace dependencies. Use a version of `azure_core` that supports
`unstable_resource_manager`; generated Resource Manager crates enable this
feature.

Clients use Azure Public cloud when cloud configuration is omitted. Start
with the [default-cloud construction example][default-cloud], which uses
`DeveloperToolsCredential` and the signed-in developer tool's configuration.

For an explicit cloud, use the [custom-cloud construction example][custom-cloud].
It passes the same configuration to `ClientSecretCredential` and the service
client. Configure the identity authority, management endpoint, and authentication
audience separately; the endpoint and audience need not be the same URL. Register
the audience with `azure_core::cloud::resource_manager::Audience`, shared across
Resource Manager crates.

Await a long-running operation's poller for its final response, or stream its
polling responses before awaiting the result.

[default-cloud]: test/other/resource_manager/examples/default_cloud.rs
[custom-cloud]: test/other/resource_manager/examples/custom_cloud.rs

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit <https://cla.microsoft.com>.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
