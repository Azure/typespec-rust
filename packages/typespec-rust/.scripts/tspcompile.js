// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { semaphore } from './semaphore.js';

// limit to 8 concurrent builds
const sem = semaphore(8);

const pkgRoot = execSync('git rev-parse --show-toplevel').toString().trim() + '/packages/typespec-rust/';

const httpSpecs = pkgRoot + 'node_modules/@typespec/http-specs/specs/';
const azureHttpSpecs = pkgRoot + 'node_modules/@azure-tools/azure-http-specs/specs/';

const compiler = pkgRoot + 'node_modules/@typespec/compiler/cmd/tsp.js';

// the format is as follows
// 'crateName': { input: 'input dir', output: 'optional output dir', args: [optional args] }
// if no .tsp file is specified in input, it's assumed to be main.tsp
const httpSpecsGroup = {
  'spector_apikey': {input: 'authentication/api-key'},
  'spector_customauth': {input: 'authentication/http/custom'},
  'spector_oauth2': {input: 'authentication/oauth2'},
  'spector_unionauth': {input: 'authentication/union'},
  'spector_bytes': {input: 'encode/bytes'}, // TODO: nested arrays and "raw" request/responses (i.e. the orphan problem)
  'spector_datetime': {input: 'encode/datetime'},
  'spector_duration': {input: 'encode/duration'},
  'spector_numeric': {input: 'encode/numeric'},
  'spector_bodyoptional': {input: 'parameters/body-optionality'},
  'spector_basicparams': {input: 'parameters/basic'},
  'spector_collectionfmt': {input: 'parameters/collection-format'},
  'spector_path': {input: 'parameters/path'},
  'spector_spread': {input: 'parameters/spread'},
  'spector_contentneg': {input: 'payload/content-negotiation'},
  'spector_jmergepatch': {input: 'payload/json-merge-patch'},
  'spector_corepageable': {input: 'payload/pageable'},
  'spector_mediatype': {input: 'payload/media-type'},
  //'spector_multipart': {input: 'payload/multipart'},
  'spector_xml': {input: 'payload/xml'},
  'spector_routes': {input: 'routes'},
  'spector_jsonencodedname': {input: 'serialization/encoded-name/json'},
  'spector_noendpoint': {input: 'server/endpoint/not-defined'},
  'spector_multiple': {input: 'server/path/multiple'},
  'spector_single': {input: 'server/path/single'},
  'spector_unversioned': {input: 'server/versions/not-versioned'},
  'spector_versioned': {input: 'server/versions/versioned'},
  //'spector_condreq': {input: 'special-headers/conditional-request'},
  //'spector_repeatability': {input: 'special-headers/repeatability'},
  'spector_specialwords': {input: 'special-words'},
  'spector_array': {input: 'type/array'},           // needs additional codegen work before we can add tests
  'spector_dictionary': {input: 'type/dictionary'}, // needs additional codegen work before we can add tests
  'spector_extensible': {input: 'type/enum/extensible'},
  'spector_fixed': {input: 'type/enum/fixed'},
  'spector_empty': {input: 'type/model/empty'},
  'spector_enumdisc': {input: 'type/model/inheritance/enum-discriminator'},
  'spector_nodisc': {input: 'type/model/inheritance/not-discriminated'},
  //'spector_recursive': {input: 'type/model/inheritance/recursive'},
  'spector_singledisc': {input: 'type/model/inheritance/single-discriminator'},
  'spector_usage': {input: 'type/model/usage'},
  //'spector_visibility': {input: 'type/model/visibility'},
  //'spector_addlprops': {input: 'type/property/additional-properties'},
  'spector_nullable': {input: 'type/property/nullable'},
  'spector_optionality': {input: 'type/property/optionality'},
  'spector_valuetypes': {input: 'type/property/value-types'},
  'spector_scalar': {input: 'type/scalar'},
  //'spector_union': {input: 'type/union'},
  'spector_union_discriminated': {input: 'type/union/discriminated'},
  //'spector_veradded': {input: 'versioning/added'},
  'spector_madeoptional': {input: 'versioning/madeOptional'},
  //'spector_verremoved': {input: 'versioning/removed'},
  //'spector_renamedfrom': {input: 'versioning/renamedFrom'},
  //'spector_returntypechanged': {input: 'versioning/returnTypeChangedFrom'},
  //'spector_typechanged': {input: 'versioning/typeChangedFrom'},
};

const azureHttpSpecsGroup = {
  //'spector_access': {input: 'azure/client-generator-core/access'},
  'spector_apiverheader': {input: 'azure/client-generator-core/api-version/header/client.tsp'},
  'spector_apiverpath': {input: 'azure/client-generator-core/api-version/path/client.tsp'},
  'spector_apiverquery': {input: 'azure/client-generator-core/api-version/query/client.tsp'},
  'spector_clientinit_default': {input: 'azure/client-generator-core/client-initialization/default'},
  'spector_clientinit_individually': {input: 'azure/client-generator-core/client-initialization/individually'},
  'spector_clientinit_individually_parent': {input: 'azure/client-generator-core/client-initialization/individuallyParent'},
  'spector_clientloc_move1': {input: 'azure/client-generator-core/client-location/move-method-parameter-to-client'},
  'spector_clientloc_move2': {input: 'azure/client-generator-core/client-location/move-to-existing-sub-client'},
  'spector_clientloc_move3': {input: 'azure/client-generator-core/client-location/move-to-new-sub-client'},
  'spector_clientloc_move4': {input: 'azure/client-generator-core/client-location/move-to-root-client'},
  'spector_emptystringasnone': {input: 'azure/client-generator-core/deserialize-empty-string-as-null'},
  'spector_flattenproperty': {input: 'azure/client-generator-core/flatten-property'},
  'spector_corenextlinkverb': {input: 'azure/client-generator-core/next-link-verb'},
  //'spector_coreoverride': {input: 'azure/client-generator-core/override/client.tsp'},
  'spector_coreusage': {input: 'azure/client-generator-core/usage'},
  'spector_basic': {input: 'azure/core/basic'},
  'spector_lrorpc': {input: 'azure/core/lro/rpc'},
  'spector_lrostd': {input: 'azure/core/lro/standard'},
  'spector_coremodel': {input: 'azure/core/model'},
  'spector_corepage': {input: 'azure/core/page'},
  'spector_corescalar': {input: 'azure/core/scalar'},
  'spector_coretraits': {input: 'azure/core/traits'},
  'spector_azureduration': {input: 'azure/encode/duration'},
  'spector_azurepageable': {input: 'azure/payload/pageable'},
  'spector_azurebasic': {input: 'azure/example/basic'},
  'spector_armcommon': {input: 'azure/resource-manager/common-properties'},
  'spector_armlargeheader': {input: 'azure/resource-manager/large-header'},
  'spector_armmethodsub': {input: 'azure/resource-manager/method-subscription-id/client.tsp'},
  'spector_armnonresource': {input: 'azure/resource-manager/non-resource'},
  'spector_armoptemplates': {input: 'azure/resource-manager/operation-templates'},
  'spector_armresources': {input: 'azure/resource-manager/resources'},
  'spector_arm_multi_service': {input: 'azure/resource-manager/multi-service/client.tsp'},
  'spector_requestidheader': {input: 'azure/special-headers/client-request-id'},
  'spector_azpreviewversion': {input: 'azure/versioning/previewVersion'},
  'spector_azure_client_namespace': {input: 'client/namespace/client.tsp', output: 'azure/client/namespace'},
  'spector_naming': {input: 'client/naming'},
  'spector_enumconflict': {input: 'client/naming/enum-conflict', output: 'client/enum-conflict'},
  'spector_overload': {input: 'client/overload/client.tsp'},
  'spector_clientopgroup': {input: 'client/structure/client-operation-group/client.tsp'},
  'spector_default': {input: 'client/structure/default/client.tsp'},
  'spector_multiclient': {input: 'client/structure/multi-client/client.tsp'},
  'spector_renamedop': {input: 'client/structure/renamed-operation/client.tsp'},
  'spector_twoop': {input: 'client/structure/two-operation-group/client.tsp'},
  'spector_srvdrivenold': {input: 'resiliency/srv-driven/old.tsp', output: 'resiliency/srv-driven/old'},
  'spector_srvdrivennew': {input: 'resiliency/srv-driven', output: 'resiliency/srv-driven/new'},
  //'spector_multi_service': {input: 'service/multi-service/client.tsp'},
};

const args = process.argv.slice(2);
var filter = undefined;
const switches = [];
for (var i = 0 ; i < args.length; i += 1) {
  const filterArg = args[i].match(/--filter=(?<filter>\w+)/);
  if (filterArg) {
    filter = filterArg.groups['filter'];
    continue;
  }
  switch (args[i]) {
    case '--verbose':
      switches.push('--verbose');
      break;
    default:
      break;
  }
}

if (filter !== undefined) {
  console.log("Using filter: " + filter)
}

function should_generate(name) {
  if (filter !== undefined) {
    const re = new RegExp(filter);
    return re.test(name)
  }
  return true
}

const alternate_types = pkgRoot + 'test/tsp/AlternateTypes';
generate('alternate_types', alternate_types, 'test/other/alternate_types');

const appconfiguration = pkgRoot + 'test/tsp/AppConfiguration/client.tsp';
generate('appconfiguration', appconfiguration, 'test/sdk/appconfiguration');

const keyvault_secrets = pkgRoot + 'test/tsp/Security.KeyVault.Secrets/client.tsp';
generate('keyvault_secrets', keyvault_secrets, 'test/sdk/keyvault_secrets', ['omit-constructors=true']);

const blob_storage = pkgRoot + 'test/tsp/Microsoft.BlobStorage/client.tsp';
generate('blob_storage', blob_storage, 'test/sdk/blob_storage', ['temp-omit-doc-links=true']);

const serde_tests = pkgRoot + 'test/tsp/SerdeTests';
generate('serde_tests', serde_tests, 'test/other/serde_tests');

const doc_tests = pkgRoot + 'test/tsp/DocTests';
generate('doc_tests', doc_tests, 'test/other/doc_tests');

const enum_path_params = pkgRoot + 'test/tsp/EnumPathParams';
generate('enum_path_params', enum_path_params, 'test/other/enum_path_params');

const colliding_locals = pkgRoot + 'test/tsp/CollidingLocals';
generate('colliding_locals', colliding_locals, 'test/other/colliding_locals');

const lro = pkgRoot + 'test/tsp/lro';
generate('lro', lro, 'test/other/lro');

const misc_tests = pkgRoot + 'test/tsp/MiscTests';
generate('misc_tests', misc_tests, 'test/other/misc_tests', ['omit-constructors=true']);

const pub_crate = pkgRoot + 'test/tsp/PubCrate';
generate('pub_crate', pub_crate, 'test/other/pub_crate');

const client_option = pkgRoot + 'test/tsp/ClientOption';
generate('client_option', client_option, 'test/other/client_option');

loopSpec(httpSpecsGroup, httpSpecs)
loopSpec(azureHttpSpecsGroup, azureHttpSpecs)

function loopSpec(group, root) {
  for (const crate in group) {
    const crateSettings = group[crate];
    let additionalArgs;
    if (crateSettings.args) {
      additionalArgs = crateSettings.args;
    }
    let outDir;
    if (crateSettings.output) {
      outDir = crateSettings.output;
    } else {
      // make the output directory structure the same as the spector input directory.
      // if the input specifies a .tsp file, remove that first.
      outDir = crateSettings.input;
      if (outDir.lastIndexOf('.tsp') > -1) {
        outDir = outDir.substring(0, outDir.lastIndexOf('/'));
      }
    }
    generate(crate, root + crateSettings.input, `test/spector/${outDir}`, additionalArgs);
  }
}

function generate(crate, input, outputDir, additionalArgs) {
  if (!should_generate(crate)) {
    return
  }
  if (additionalArgs === undefined) {
    additionalArgs = [];
  } else {
    for (let i = 0; i < additionalArgs.length; ++i) {
      additionalArgs[i] = `--option="@azure-tools/typespec-rust.${additionalArgs[i]}"`;
    }
  }
  sem.take(async function() {
    // if a tsp file isn't specified, first check
    // for a client.tsp file. if that doesn't exist
    // then fall back to main.tsp.
    if (input.lastIndexOf('.tsp') === -1) {
      if (fs.existsSync(input + '/client.tsp')) {
        input += '/client.tsp';
      } else {
        input += '/main.tsp';
      }
    }
    console.log('generating ' + input);
    const fullOutputDir = pkgRoot + outputDir;
    try {
      const options = [];
      options.push(`--option="@azure-tools/typespec-rust.crate-name=${crate}"`);
      options.push(`--option="@azure-tools/typespec-rust.crate-version=0.1.0"`);
      options.push(`--option="@azure-tools/typespec-rust.emitter-output-dir=${fullOutputDir}"`);
      const command = `node ${compiler} compile ${input} --emit=${pkgRoot} ${options.join(' ')} ${additionalArgs.join(' ')}`;
      if (switches.includes('--verbose')) {
        console.log(command);
      }
      // delete all content before regenerating as it makes it
      // really easy to determine if something failed to generated
      const maxRmRetries = 4;
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      for (let attempt = 0; attempt < maxRmRetries; ++attempt) {
        const rmPath = path.join(fullOutputDir, 'src', 'generated')
        try {
          fs.rmSync(rmPath, { force: true, recursive: true });
          break;
        } catch (err) {
          if (attempt === maxRmRetries - 1) {
            throw err;
          }
          // Exponential backoff: 1s, 2s, 4s, 8s, etc. (1000ms * 2^attempt)
          const retryTimeout = 1000 * (1 << attempt);
          console.warn('\x1b[96m%s\x1b[0m', 'delete \'' + rmPath + '\' failed, will retry in ' + retryTimeout/1000 + ' second(s), that will be retry attempt #' + (attempt + 1) + ' out of ' + (maxRmRetries - 1) + '.');
          await sleep(retryTimeout);
        }
      }
      exec(command, function(error, stdout, stderr) {
        // print any output or error from the tsp compile command
        logResult(error, stdout, stderr);
      });
    } catch (err) {
      console.error('\x1b[91m%s\x1b[0m', err);
    } finally {
      sem.leave();
    }
  });
}

function logResult(error, stdout, stderr) {
  if (stdout !== '') {
    console.log('stdout: ' + stdout);
  }
  if (stderr !== '' && error !== null) {
    // if both are set just log one
    console.error('\x1b[91m%s\x1b[0m', 'exec error: ' + error);
    return;
  }
  if (stderr !== '') {
    if (stderr.startsWith('- Compiling...\n')) {
      // not really an error, not worth highlighting in red
      console.log('stderr: ' + stderr);
    } else {
      console.error('\x1b[91m%s\x1b[0m', 'stderr: ' + stderr);
    }
  }
  if (error !== null) {
    console.error('\x1b[91m%s\x1b[0m', 'exec error: ' + error);
  }
}
