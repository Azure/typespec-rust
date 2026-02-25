// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{
    http::{headers::Headers, RawResponse, Response, StatusCode, XmlFormat},
    time::OffsetDateTime,
    xml::to_xml,
};
use blob_storage::models::{
    AccessPolicy, BlobItem, BlobMetadata, GeoReplication, GeoReplicationStatusType,
    ListBlobsResponse, ObjectReplicationMetadata, SignedIdentifier, SignedIdentifiers,
    StorageServiceStats,
};
use std::collections::HashMap;
use time::{Date, Month, Time};

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

    let resp: Response<ListBlobsResponse, XmlFormat> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), xml_data).into();

    let body = resp.into_model().unwrap();
    assert_eq!(body.segment.blob_items.len(), 5);

    let blob0 = &body.segment.blob_items[0];
    let blob0_name = blob0.name.as_ref().unwrap();
    assert_eq!(blob0_name, "blob0");
    assert!(blob0.metadata.is_none());
    assert!(blob0.object_replication_metadata.is_none());

    let blob1 = &body.segment.blob_items[1];
    let blob1_name = blob1.name.as_ref().unwrap();
    assert_eq!(blob1_name, "blob1");
    let blob1_metadata = blob1.metadata.as_ref().unwrap();
    let blob1_or_metadata = blob1.object_replication_metadata.as_ref().unwrap();
    assert!(blob1_metadata.additional_properties.is_none());
    assert!(blob1_metadata.encrypted.is_none());
    assert!(blob1_or_metadata.additional_properties.is_none());

    let blob2 = &body.segment.blob_items[2];
    let blob2_name = blob2.name.as_ref().unwrap();
    assert_eq!(blob2_name, "blob2");
    let blob2_metadata = blob2.metadata.as_ref().unwrap();
    let blob2_addl_props = blob2_metadata.additional_properties.as_ref().unwrap();
    assert_eq!(blob2_addl_props.len(), 2);
    assert_eq!(blob2_addl_props["Foo"], "bar".to_string());
    assert_eq!(blob2_addl_props["Baz"], "blah".to_string());
    assert_eq!(blob2_metadata.encrypted, Some("abc123".to_string()));
    assert!(blob2.object_replication_metadata.is_none());

    let blob3 = &body.segment.blob_items[3];
    let blob3_name = blob3.name.as_ref().unwrap();
    assert_eq!(blob3_name, "blob3");
    assert!(blob3.metadata.is_none());
    let blob3_or_metadata = blob3.object_replication_metadata.as_ref().unwrap();
    let blob3_or_addl_props = blob3_or_metadata.additional_properties.as_ref().unwrap();
    assert_eq!(blob3_or_addl_props.len(), 2);
    assert_eq!(blob3_or_addl_props["ding"], "dong".to_string());
    assert_eq!(blob3_or_addl_props["ring"], "Ring".to_string());

    let blob4 = &body.segment.blob_items[4];
    let blob4_name = blob4.name.as_ref().unwrap();
    assert_eq!(blob4_name, "blob4");
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

    let mut blob_item_internal = BlobItem::default();
    blob_item_internal.metadata = Some(blob_metadata);
    blob_item_internal.object_replication_metadata = Some(or_metadata);

    let xml_body = to_xml(&blob_item_internal).unwrap();
    assert_eq!(
        xml_body,
        r#"<?xml version="1.0" encoding="utf-8"?><Blob><Metadata Encrypted="abc123"><foo>bar</foo></Metadata><OrMetadata><ding>Dong</ding></OrMetadata></Blob>"#
    );
}

#[tokio::test]
async fn vec_signed_identifier_de() {
    let xml_data = r#"<?xml version="1.0" encoding="utf-8"?>
    <SignedIdentifiers>
        <SignedIdentifier>
            <Id>testid0</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02Z</Start>
                <Expiry>2025-11-05T21:14:12Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid1</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.1Z</Start>
                <Expiry>2025-11-05T21:14:12.1Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid2</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.12Z</Start>
                <Expiry>2025-11-05T21:14:12.12Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid3</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.123Z</Start>
                <Expiry>2025-11-05T21:14:12.123Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid4</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.1234Z</Start>
                <Expiry>2025-11-05T21:14:12.1234Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid5</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.12345Z</Start>
                <Expiry>2025-11-05T21:14:12.12345Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid6</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.123456Z</Start>
                <Expiry>2025-11-05T21:14:12.123456Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
        <SignedIdentifier>
            <Id>testid7</Id>
            <AccessPolicy>
                <Start>2025-11-05T21:14:02.1234567Z</Start>
                <Expiry>2025-11-05T21:14:12.1234567Z</Expiry>
                <Permission>rw</Permission>
            </AccessPolicy>
        </SignedIdentifier>
    </SignedIdentifiers>"#;

    let resp: Response<SignedIdentifiers, XmlFormat> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), xml_data).into();

    let signed_identifiers = resp.into_model().unwrap();
    let items = signed_identifiers.items.unwrap();
    assert_eq!(items.len(), 8);

    let mut milliseconds = 0;
    let mut microseconds = 0;
    let mut nanoseconds = 0;
    for (i, signed_identifier) in items.iter().enumerate() {
        assert_eq!(signed_identifier.id, Some(format!("testid{i}")));
        let access_policy = signed_identifier.access_policy.as_ref().unwrap();
        let expiry = access_policy.expiry.as_ref().unwrap();
        assert_eq!(expiry.millisecond(), milliseconds);
        assert_eq!(expiry.microsecond(), microseconds);
        assert_eq!(expiry.nanosecond(), nanoseconds);

        // Increment to match the pattern in XML data
        match i {
            0 => {
                milliseconds = 100;
                microseconds = 100_000;
                nanoseconds = 100_000_000;
            } // .1
            1 => {
                milliseconds = 120;
                microseconds = 120_000;
                nanoseconds = 120_000_000;
            } // .12
            2 => {
                milliseconds = 123;
                microseconds = 123_000;
                nanoseconds = 123_000_000;
            } // .123
            3 => {
                microseconds = 123_400;
                nanoseconds = 123_400_000;
            } // .1234
            4 => {
                microseconds = 123_450;
                nanoseconds = 123_450_000;
            } // .12345
            5 => {
                microseconds = 123_456;
                nanoseconds = 123_456_000;
            } // .123456
            6 => {
                nanoseconds = 123_456_700;
            } // .1234567
            _ => {}
        }
    }
}

#[tokio::test]
async fn vec_signed_identifier_se() {
    let base_date = Date::from_calendar_date(2025, Month::November, 5).unwrap();
    let start_time = Time::from_hms(21, 14, 2).unwrap();
    let expiry_time = Time::from_hms(21, 14, 12).unwrap();

    let mut items = Vec::new();

    // testid0: no fractional seconds
    let si0 = SignedIdentifier {
        id: Some("testid0".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(OffsetDateTime::new_utc(base_date, start_time)),
            expiry: Some(OffsetDateTime::new_utc(base_date, expiry_time)),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si0);

    // testid1: .1 (100ms)
    let si1 = SignedIdentifier {
        id: Some("testid1".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(100_000_000)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(100_000_000)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si1);

    // testid2: .12 (120ms)
    let si2 = SignedIdentifier {
        id: Some("testid2".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(120_000_000)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(120_000_000)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si2);

    // testid3: .123 (123ms)
    let si3 = SignedIdentifier {
        id: Some("testid3".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(123_000_000)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(123_000_000)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si3);

    // testid4: .1234 (123.4ms)
    let si4 = SignedIdentifier {
        id: Some("testid4".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(123_400_000)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(123_400_000)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si4);

    // testid5: .12345 (123.45ms)
    let si5 = SignedIdentifier {
        id: Some("testid5".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(123_450_000)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(123_450_000)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si5);

    // testid6: .123456 (123.456ms)
    let si6 = SignedIdentifier {
        id: Some("testid6".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(123_456_000)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(123_456_000)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si6);

    // testid7: .1234567 (123.4567ms)
    let si7 = SignedIdentifier {
        id: Some("testid7".to_string()),
        access_policy: Some(AccessPolicy {
            start: Some(
                OffsetDateTime::new_utc(base_date, start_time)
                    .replace_nanosecond(123_456_700)
                    .unwrap(),
            ),
            expiry: Some(
                OffsetDateTime::new_utc(base_date, expiry_time)
                    .replace_nanosecond(123_456_700)
                    .unwrap(),
            ),
            permission: Some("rw".to_string()),
        }),
    };
    items.push(si7);

    let signed_identifiers = SignedIdentifiers { items: Some(items) };

    let xml_body = to_xml(&signed_identifiers).unwrap();
    let xml_str = String::from_utf8(xml_body.to_vec()).unwrap();

    // Verify the serialized XML contains all the test IDs and timestamps
    assert!(xml_str.contains("<Id>testid0</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.0000000Z</Start>"));
    assert!(xml_str.contains("<Id>testid1</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1000000Z</Start>"));
    assert!(xml_str.contains("<Id>testid2</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1200000Z</Start>"));
    assert!(xml_str.contains("<Id>testid3</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1230000Z</Start>"));
    assert!(xml_str.contains("<Id>testid4</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1234000Z</Start>"));
    assert!(xml_str.contains("<Id>testid5</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1234500Z</Start>"));
    assert!(xml_str.contains("<Id>testid6</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1234560Z</Start>"));
    assert!(xml_str.contains("<Id>testid7</Id>"));
    assert!(xml_str.contains("<Start>2025-11-05T21:14:02.1234567Z</Start>"));
}

#[tokio::test]
async fn geo_replication_de() {
    let xml_data = r#"<?xml version="1.0" encoding="utf-8"?>
    <StorageServiceStats>
        <GeoReplication>
            <LastSyncTime>Wed, 23 Oct 2013 22:05:54 GMT</LastSyncTime>
            <Status>live</Status>
        </GeoReplication>
    </StorageServiceStats>"#;

    let resp: Response<StorageServiceStats, XmlFormat> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), xml_data).into();

    let body = resp.into_model().unwrap();
    let geo_replication = body.geo_replication.unwrap();
    assert_eq!(
        geo_replication.status.as_ref().unwrap(),
        &GeoReplicationStatusType::Live
    );
}

#[tokio::test]
async fn geo_replication_se() {
    let mut storage_service_stats = StorageServiceStats::default();
    let mut geo_replication = GeoReplication::default();

    geo_replication.last_sync_time = Some(OffsetDateTime::new_utc(
        Date::from_calendar_date(2013, Month::October, 23).unwrap(),
        Time::from_hms(22, 5, 54).unwrap(),
    ));
    geo_replication.status = Some(GeoReplicationStatusType::Live);

    storage_service_stats.geo_replication = Some(geo_replication);
    let xml_body = to_xml(&storage_service_stats).unwrap();
    assert_eq!(
        xml_body,
        r#"<?xml version="1.0" encoding="utf-8"?><StorageServiceStats><GeoReplication><LastSyncTime>Wed, 23 Oct 2013 22:05:54 GMT</LastSyncTime><Status>live</Status></GeoReplication></StorageServiceStats>"#
    );
}
