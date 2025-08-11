import "@azure-tools/typespec-client-generator-core";
import "./main.tsp";
import "./models.tsp";

using TypeSpec.Http;
using TypeSpec.Versioning;
using Azure.ClientGenerator.Core;

@versioned(KeyVault.Versions)
namespace Customizations;

/**
 * The GET operation is applicable to any secret stored in Azure Key Vault. This operation requires the secrets/get permission.
 */
#suppress "@azure-tools/typespec-azure-core/use-standard-operations" "Foundations.Operation is necessary for Key Vault"
@summary("Get a specified secret from a given key vault.")
@route("/secrets/{secret-name}/{secret-version}")
@get
op getSecret is Azure.Core.Foundations.Operation<
  {
    /**
     * The name of the secret.
     */
    @path("secret-name")
    @clientName("name", "go")
    secretName: string;

    /**
     * The version of the secret. This URI fragment is optional. If not specified, the latest version of the secret is returned.
     */
    @path("secret-version")
    @clientName("version", "go")
    secretVersion: string;
  },
  KeyVault.SecretBundle,
  {},
  KeyVault.KeyVaultError
>;

@@override(KeyVault.getSecret, getSecret, "!rust");
