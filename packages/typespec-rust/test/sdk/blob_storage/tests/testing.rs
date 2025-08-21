// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{
    http::{headers::Headers, RawResponse, Response, StatusCode, XmlFormat},
    xml::to_xml,
};
use blob_storage::models::{
    BlobItemInternal, BlobMetadata, ListBlobsFlatSegmentResponse, ObjectReplicationMetadata,
};
use std::collections::HashMap;

#[tokio::test]
async fn additional_properties_de() {
    let xml_data = r#"<?xml version="1.0" encoding="utf-8"?>
    <EnumerationResults ServiceEndpoint="https://contoso.blob.core.windows.net/" ContainerName="container1">
        <Blobs>
            <Blob>
                <Name>blob0</Name>
            </Blob>
            <Blob>
                <Name>blob1</Name>
                <Metadata />
                <OrMetadata />
            </Blob>
            <Blob>
                <Name>blob2</Name>
                <Metadata Encrypted="abc123">
                    <Foo>bar</Foo>
                    <Baz>blah</Baz>
                </Metadata>
            </Blob>
            <Blob>
                <Name>blob3</Name>
                <OrMetadata>
                    <ding>dong</ding>
                    <ring>Ring</ring>
                </OrMetadata>
            </Blob>
            <Blob>
                <Name>blob4</Name>
                <Metadata>
                    <Foo>bar</Foo>
                    <Baz>blah</Baz>
                </Metadata>
                <OrMetadata>
                    <ding>dong</ding>
                    <ring>Ring</ring>
                </OrMetadata>
            </Blob>
        </Blobs>
        <NextMarker />
    </EnumerationResults>"#;

    let resp: Response<ListBlobsFlatSegmentResponse, XmlFormat> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), xml_data).into();

    let body = resp.into_body().await.unwrap();
    assert_eq!(body.segment.blob_items.len(), 5);

    let blob0 = &body.segment.blob_items[0];
    let blob0_name = blob0.name.as_ref().unwrap();
    assert_eq!(blob0_name.content, Some("blob0".to_string()));
    assert!(blob0.metadata.is_none());
    assert!(blob0.object_replication_metadata.is_none());

    let blob1 = &body.segment.blob_items[1];
    let blob1_name = blob1.name.as_ref().unwrap();
    assert_eq!(blob1_name.content, Some("blob1".to_string()));
    let blob1_metadata = blob1.metadata.as_ref().unwrap();
    let blob1_or_metadata = blob1.object_replication_metadata.as_ref().unwrap();
    assert!(blob1_metadata.additional_properties.is_none());
    assert!(blob1_metadata.encrypted.is_none());
    assert!(blob1_or_metadata.additional_properties.is_none());

    let blob2 = &body.segment.blob_items[2];
    let blob2_name = blob2.name.as_ref().unwrap();
    assert_eq!(blob2_name.content, Some("blob2".to_string()));
    let blob2_metadata = blob2.metadata.as_ref().unwrap();
    let blob2_addl_props = blob2_metadata.additional_properties.as_ref().unwrap();
    assert_eq!(blob2_addl_props.len(), 2);
    assert_eq!(blob2_addl_props["Foo"], "bar".to_string());
    assert_eq!(blob2_addl_props["Baz"], "blah".to_string());
    assert_eq!(blob2_metadata.encrypted, Some("abc123".to_string()));
    assert!(blob2.object_replication_metadata.is_none());

    let blob3 = &body.segment.blob_items[3];
    let blob3_name = blob3.name.as_ref().unwrap();
    assert_eq!(blob3_name.content, Some("blob3".to_string()));
    assert!(blob3.metadata.is_none());
    let blob3_or_metadata = blob3.object_replication_metadata.as_ref().unwrap();
    let blob3_or_addl_props = blob3_or_metadata.additional_properties.as_ref().unwrap();
    assert_eq!(blob3_or_addl_props.len(), 2);
    assert_eq!(blob3_or_addl_props["ding"], "dong".to_string());
    assert_eq!(blob3_or_addl_props["ring"], "Ring".to_string());

    let blob4 = &body.segment.blob_items[4];
    let blob4_name = blob4.name.as_ref().unwrap();
    assert_eq!(blob4_name.content, Some("blob4".to_string()));
    let blob4_metadata = blob4.metadata.as_ref().unwrap();
    let blob4_addl_props = blob4_metadata.additional_properties.as_ref().unwrap();
    assert_eq!(blob4_addl_props.len(), 2);
    assert_eq!(blob4_addl_props["Foo"], "bar".to_string());
    assert_eq!(blob4_addl_props["Baz"], "blah".to_string());
    assert!(blob4_metadata.encrypted.is_none());
    let blob4_or_metadata = blob4.object_replication_metadata.as_ref().unwrap();
    let blob4_or_addl_props = blob4_or_metadata.additional_properties.as_ref().unwrap();
    assert_eq!(blob4_or_addl_props.len(), 2);
    assert_eq!(blob4_or_addl_props["ding"], "dong".to_string());
    assert_eq!(blob4_or_addl_props["ring"], "Ring".to_string());
}

#[tokio::test]
async fn additional_properties_se() {
    let mut blob_metadata = BlobMetadata::default();
    blob_metadata.additional_properties =
        Some(HashMap::from([("foo".to_string(), "bar".to_string())]));
    blob_metadata.encrypted = Some("abc123".to_string());

    let mut or_metadata = ObjectReplicationMetadata::default();
    or_metadata.additional_properties =
        Some(HashMap::from([("ding".to_string(), "Dong".to_string())]));

    let mut blob_item_internal = BlobItemInternal::default();
    blob_item_internal.metadata = Some(blob_metadata);
    blob_item_internal.object_replication_metadata = Some(or_metadata);

    let xml_body = to_xml(&blob_item_internal).unwrap();
    assert_eq!(
        xml_body,
        r#"<?xml version="1.0" encoding="utf-8"?><Blob><Metadata Encrypted="abc123"><foo>bar</foo></Metadata><OrMetadata><ding>Dong</ding></OrMetadata></Blob>"#
    );
}
