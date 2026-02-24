// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_naming::{
    union_enum::models::{ClientExtensibleEnum, ExtensibleEnum},
    NamingClient,
};

#[tokio::test]
async fn union_enum_member_name() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_naming_union_enum_client()
        .union_enum_member_name(ExtensibleEnum::ClientEnumValue1.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn union_enum_name() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_naming_union_enum_client()
        .union_enum_name(ClientExtensibleEnum::EnumValue1.try_into().unwrap(), None)
        .await
        .unwrap();
}
