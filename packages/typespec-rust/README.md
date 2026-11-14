# TypeSpec Rust Generator

The TypeSpec Rust generator is intended to be used with the TypeSpec compiler.
Generated crates should forward their `default` feature to `azure_core/default`
by setting `default = ["azure_core/default"]` in the `[features]` section of
`Cargo.toml`. Declare the `azure_core` dependency with `default-features = false`,
including in `[workspace.dependencies]` when inherited from a workspace.
Together, these settings enable the default HTTP transport while allowing callers
to disable it with `--no-default-features`.

## Azure Resource Manager

ARM services are detected from TypeSpec metadata. Generated crates enable
`azure_core/unstable_resource_manager` and use Public cloud by default.
For other clouds, pass the same cloud configuration to the credential and client.
See the [default-cloud][default-cloud] and [custom-cloud][custom-cloud] examples.

Generated pagers and pollers use shared Azure Core helpers, keeping paging and
long-running operation behavior consistent with ARM conventions.

[default-cloud]: test/other/resource_manager/examples/default_cloud.rs
[custom-cloud]: test/other/resource_manager/examples/custom_cloud.rs

## Fake servers

Fake server generation is disabled by default. Opt in for data-plane or Resource
Manager clients with the emitter option:

```yaml
options:
  "@azure-tools/typespec-rust":
    generate-fakes: true
```

Enable the generated crate's `unstable_fake` Cargo feature (which also enables
`test`), implement its `clients::fake::<Name>Server` trait, and construct the client
with `with_fake()`. No credential is needed. Fakes use the normal client pipeline,
pagers, and pollers. See the offline [Key Vault secrets example][secrets-fake] and
[Resource Manager LRO example][arm-fake].

[secrets-fake]: test/sdk/keyvault_secrets/examples/secret_client_fake.rs
[arm-fake]: test/other/resource_manager/examples/fake.rs

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
