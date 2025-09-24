import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-client-generator-core";
import "@typespec/rest";

using Azure.Core;
using Azure.ClientGenerator.Core;
using TypeSpec.Http;

@service(#{ title: "DocTestsClient"})
namespace DocTests;

model Metadata {
    @key
    id: string,

    @alternateType(Record<string>, "rust")
    @header("x-ms-meta")
    metadata?: string;

    ...RequestIdResponseHeader
};

@get op getMetadata(@path id: Metadata.id): Metadata;
