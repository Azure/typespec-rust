// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { exec, execSync } from 'child_process';
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
  //'spector_apikey': {input: 'authentication/api-key'},
  //'spector_custom': {input: 'authentication/http/custom'},
  'spector_oauth2': {input: 'authentication/oauth2'},
  'spector_unionauth': {input: 'authentication/union'},
  'spector_bytes': {input: 'encode/bytes'}, // TODO: nested arrays and "raw" request/responses (i.e. the orphan problem)
  //'spector_datetime': {input: 'encode/datetime'},
  'spector_duration': {input: 'encode/duration'},
  //'spector_bodyoptional': {input: 'parameters/body-optionality'},
  'spector_basicparams': {input: 'parameters/basic'},
  'spector_collectionfmt': {input: 'parameters/collection-format'},
  'spector_spread': {input: 'parameters/spread'},
  'spector_contentneg': {input: 'payload/content-negotiation'},
  'spector_jmergepatch': {input: 'payload/json-merge-patch'},
  //'spector_mediatype': {input: 'payload/media-type'},
  //'spector_multipart': {input: 'payload/multipart'},
  'spector_xml': {input: 'payload/xml'},
  //'spector_routes': {input: 'routes'},
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
  //'spector_enumdisc': {input: 'type/model/inheritance/enum-discriminator'},
  //'spector_nodisc': {input: 'type/model/inheritance/not-discriminated'},
  //'spector_recursive': {input: 'type/model/inheritance/recursive'},
  //'spector_singledisc': {input: 'type/model/inheritance/single-discriminator'},
  'spector_usage': {input: 'type/model/usage'},
  //'spector_visibility': {input: 'type/model/visibility'},
  //'spector_addlprops': {input: 'type/property/additional-properties'},
  //'spector_nullable': {input: 'type/property/nullable'},
  //'spector_optionality': {input: 'type/property/optionality'},
  //'spector_valuetypes': {input: 'type/property/value-types'},
  //'spector_scalar': {input: 'type/scalar'},
  //'spector_union': {input: 'type/union'},
};

const azureHttpSpecsGroup = {
  //'spector_access': {input: 'azure/client-generator-core/access'},
  'spector_flattenproperty': {input: 'azure/client-generator-core/flatten-property'},
  //'spector_coreusage': {input: 'azure/client-generator-core/usage'},
  'spector_basic': {input: 'azure/core/basic'},
  //'spector_lrorpc': {input: 'azure/core/lro/rpc'},
  //'spector_lrostd': {input: 'azure/core/lro/standard'},
  //'spector_corepage': {input: 'azure/core/page'},
  //'spector_corescalar': {input: 'azure/core/scalar'},
  //'spector_traits': {input: 'azure/core/traits'},
  'spector_azurepageable': {input: 'azure/payload/pageable'},
  'spector_azurebasic': {input: 'azure/example/basic'},
  'spector_armcommon': {input: 'azure/resource-manager/common-properties'},
  //'spector_armresources': {input: 'azure/resource-manager/resources'},
  //'spector_naming': {input: 'client/naming'},
  'spector_clientopgroup': {input: 'client/structure/client-operation-group/client.tsp'},
  'spector_default': {input: 'client/structure/default/client.tsp'},
  'spector_multiclient': {input: 'client/structure/multi-client/client.tsp'},
  'spector_renamedop': {input: 'client/structure/renamed-operation/client.tsp'},
  'spector_twoop': {input: 'client/structure/two-operation-group/client.tsp'},
  'spector_srvdrivenold': {input: 'resiliency/srv-driven/old.tsp', output: 'resiliency/srv-driven/old'},
  'spector_srvdrivennew': {input: 'resiliency/srv-driven', output: 'resiliency/srv-driven/new'},
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

const keyvault_secrets = pkgRoot + 'test/tsp/Security.KeyVault.Secrests';
generate('keyvault_secrets', keyvault_secrets, 'test/sdk/keyvault_secrets');

const blob_storage = pkgRoot + 'test/tsp/Microsoft.BlobStorage/client.tsp';
generate('blob_storage', blob_storage, 'test/sdk/blob_storage');

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
  sem.take(function() {
    // default to main.tsp if a .tsp file isn't specified in the input
    if (input.lastIndexOf('.tsp') === -1) {
      input += '/main.tsp';
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
      exec(command, function(error, stdout, stderr) {
        // print any output or error from the tsp compile command
        logResult(error, stdout, stderr);
        // format on success
        if (error === null && stderr === '') {
          execSync('cargo fmt -- --emit files', { cwd: fullOutputDir, encoding: 'ascii' });
        }
      });
    } catch (err) {
      console.error(err.output.toString());
    } finally {
      sem.leave();
    }
  });
}

function logResult(error, stdout, stderr) {
  if (stdout !== '') {
    console.log('stdout: ' + stdout);
  }
  if (stderr !== '') {
    console.error('\x1b[91m%s\x1b[0m', 'stderr: ' + stderr);
  }
  if (error !== null) {
    console.error('\x1b[91m%s\x1b[0m', 'exec error: ' + error);
  }
}
