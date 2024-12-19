// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { exec, execSync } from 'child_process';
import { semaphore } from './semaphore.js';

// limit to 8 concurrent builds
const sem = semaphore(8);

const pkgRoot = execSync('git rev-parse --show-toplevel').toString().trim() + '/packages/typespec-rust/';

const tspRoot = pkgRoot + 'node_modules/@azure-tools/cadl-ranch-specs/http/';

const compiler = pkgRoot + 'node_modules/@typespec/compiler/cmd/tsp.js';

// the format is as follows
// 'crateName': { input: 'input dir', output: 'optional output dir', args: [optional args] }
// if no .tsp file is specified in input, it's assumed to be main.tsp
const cadlRanch = {
  //'cadl_apikey': {input: 'authentication/api-key'},
  //'cadl_custom': {input: 'authentication/http/custom'},
  'cadl_oauth2': {input: 'authentication/oauth2', args: ['overwrite-cargo-toml=false']},
  'cadl_unionauth': {input: 'authentication/union', args: ['overwrite-cargo-toml=false']},
  //'cadl_access': {input: 'azure/client-generator-core/access'},
  'cadl_flattenproperty': {input: 'azure/client-generator-core/flatten-property'},
  //'cadl_coreusage': {input: 'azure/client-generator-core/usage'},
  'cadl_basic': {input: 'azure/core/basic'},
  //'cadl_lrorpc': {input: 'azure/core/lro/rpc'},
  //'cadl_lrolegacy': {input: 'azure/core/lro/rpc-legacy'},
  //'cadl_lrostd': {input: 'azure/core/lro/standard'},
  //'cadl_coremodel': {input: 'azure/core/model'},
  //'cadl_corepage': {input: 'azure/core/page'},
  //'cadl_corescalar': {input: 'azure/core/scalar'},
  //'cadl_traits': {input: 'azure/core/traits'},
  'cadl_azurebasic': {input: 'azure/example/basic'},
  //'cadl_armcommon': {input: 'azure/resource-manager/common-properties'},
  //'cadl_armresources': {input: 'azure/resource-manager/resources'},
  //'cadl_naming': {input: 'client/naming'},
  'cadl_clientopgroup': {input: 'client/structure/client-operation-group/client.tsp'},
  'cadl_default': {input: 'client/structure/default/client.tsp'},
  'cadl_multiclient': {input: 'client/structure/multi-client/client.tsp'},
  'cadl_renamedop': {input: 'client/structure/renamed-operation/client.tsp'},
  'cadl_twoop': {input: 'client/structure/two-operation-group/client.tsp'},
  'cadl_bytes': {input: 'encode/bytes'}, // TODO: nested arrays and "raw" request/responses (i.e. the orphan problem)
  //'cadl_datetime': {input: 'encode/datetime'},
  //'cadl_duration': {input: 'encode/duration'},
  //'cadl_bodyoptional': {input: 'parameters/body-optionality'},
  'cadl_basicparams': {input: 'parameters/basic'},
  'cadl_collectionfmt': {input: 'parameters/collection-format'},
  'cadl_spread': {input: 'parameters/spread'},
  'cadl_contentneg': {input: 'payload/content-negotiation'},
  'cadl_jmergepatch': {input: 'payload/json-merge-patch'},
  //'cadl_mediatype': {input: 'payload/media-type'},
  //'cadl_multipart': {input: 'payload/multipart'},
  'cadl_pageable': {input: 'payload/pageable'},
  'cadl_xml': {input: 'payload/xml'},
  'cadl_srvdrivenold': {input: 'resiliency/srv-driven/old.tsp', output: 'resiliency/srv-driven/old'},
  'cadl_srvdrivennew': {input: 'resiliency/srv-driven', output: 'resiliency/srv-driven/new'},
  //'cadl_routes': {input: 'routes'},
  'cadl_jsonencodedname': {input: 'serialization/encoded-name/json'},
  'cadl_noendpoint': {input: 'server/endpoint/not-defined'},
  'cadl_multiple': {input: 'server/path/multiple'},
  'cadl_single': {input: 'server/path/single'},
  'cadl_unversioned': {input: 'server/versions/not-versioned'},
  'cadl_versioned': {input: 'server/versions/versioned'},
  //'cadl_clientreqid': {input: 'special-headers/client-request-id'},
  //'cadl_condreq': {input: 'special-headers/conditional-request'},
  //'cadl_repeatability': {input: 'special-headers/repeatability'},
  'cadl_specialwords': {input: 'special-words'},
  'cadl_array': {input: 'type/array'},           // needs additional codegen work before we can add tests
  'cadl_dictionary': {input: 'type/dictionary'}, // needs additional codegen work before we can add tests
  'cadl_extensible': {input: 'type/enum/extensible'},
  'cadl_fixed': {input: 'type/enum/fixed'},
  'cadl_empty': {input: 'type/model/empty'},
  //'cadl_enumdisc': {input: 'type/model/inheritance/enum-discriminator'},
  //'cadl_nodisc': {input: 'type/model/inheritance/not-discriminated'},
  //'cadl_recursive': {input: 'type/model/inheritance/recursive'},
  //'cadl_singledisc': {input: 'type/model/inheritance/single-discriminator'},
  'cadl_usage': {input: 'type/model/usage'},
  //'cadl_visibility': {input: 'type/model/visibility'},
  //'cadl_addlprops': {input: 'type/property/additional-properties'},
  //'cadl_nullable': {input: 'type/property/nullable'},
  //'cadl_optionality': {input: 'type/property/optionality'},
  //'cadl_valuetypes': {input: 'type/property/value-types'},
  //'cadl_scalar': {input: 'type/scalar'},
  //'cadl_union': {input: 'type/union'},
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

for (const crate in cadlRanch) {
  const crateSettings = cadlRanch[crate];
  let additionalArgs;
  if (crateSettings.args) {
    additionalArgs = crateSettings.args;
  }
  let outDir;
  if (crateSettings.output) {
    outDir = crateSettings.output;
  } else {
    // make the output directory structure the same as the cadl input directory.
    // if the input specifies a .tsp file, remove that first.
    outDir = crateSettings.input;
    if (outDir.lastIndexOf('.tsp') > -1) {
      outDir = outDir.substring(0, outDir.lastIndexOf('/'));
    }
  }
  generate(crate, tspRoot + crateSettings.input, `test/cadlranch/${outDir}`, additionalArgs);
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
      options.push(`--option="@azure-tools/typespec-rust.overwrite-cargo-toml=true"`);
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
