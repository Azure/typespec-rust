import "@azure-tools/typespec-client-generator-core";

using Azure.ClientGenerator.Core;

namespace SerdeTests;

@encode(BytesKnownEncoding.base64url)
scalar base64urlBytes extends bytes;

model BytesVectors {
  vecBytes: bytes[];
  vecUrlBytes: base64urlBytes[];
  vecVecBytes: bytes[][];
  vecVecUrlBytes: base64urlBytes[][];
  vecVecVecBytes: bytes[][][];
  vecVecVecUrlBytes: base64urlBytes[][][];
}

model BytesRecords {
  mapBytes: Record<bytes>;
  mapUrlBytes: Record<base64urlBytes>;
  mapMapBytes: Record<Record<bytes>>;
  mapMapUrlBytes: Record<Record<base64urlBytes>>;
  mapMapMapBytes: Record<Record<Record<bytes>>>;
  mapMapMapUrlBytes: Record<Record<Record<base64urlBytes>>>;
}

model BytesMixed {
  mapVecBytes: Record<bytes[]>;
  mapVecUrlBytes: Record<base64urlBytes[]>;
  vecMapBytes: Record<bytes[]>[];
  vecMapUrlBytes: Record<base64urlBytes[]>[];
}

@encode(DateTimeKnownEncoding.unixTimestamp, int64)
scalar unixDatetime extends utcDateTime;

@encode(DateTimeKnownEncoding.rfc7231)
scalar rfc7231Datetime extends utcDateTime;

model OffsetDateTimeVectors {
  vecRFC3339: offsetDateTime[];
  vecRFC7231: rfc7231Datetime[];
  vecUnix: unixDatetime[];
  vecVecRFC3339: offsetDateTime[][];
  vecVecRFC7231: rfc7231Datetime[][];
  vecVecUnix: unixDatetime[][];
  vecVecVecRFC3339: offsetDateTime[][][];
  vecVecVecRFC7231: rfc7231Datetime[][][];
  vecVecVecUnix: unixDatetime[][][];
}

model OffsetDateTimeRecords {
  mapRFC3339: Record<offsetDateTime>;
  mapRFC7231: Record<rfc7231Datetime>;
  mapUnix: Record<unixDatetime>;
  mapMapRFC3339: Record<Record<offsetDateTime>>;
  mapMapRFC7231: Record<Record<rfc7231Datetime>>;
  mapMapUnix: Record<Record<unixDatetime>>;
  mapMapMapRFC3339: Record<Record<Record<offsetDateTime>>>;
  mapMapMapRFC7231: Record<Record<Record<rfc7231Datetime>>>;
  mapMapMapUnix: Record<Record<Record<unixDatetime>>>;
}

model OffsetDateTimeMixed {
  mapVecRFC7231: Record<rfc7231Datetime[]>;
  mapVecUnix: Record<unixDatetime[]>;
  vecMapRFC3339: Record<offsetDateTime[]>[];
  vecMapUnix: Record<unixDatetime[]>[];
}

union RecursiveNullableType {
  null,
  {
    inner?: RecursiveNullableType,
  },
}

model OuterWithNullable {
  value?: RecursiveNullableType;
}

model OuterType {
  value: MiddleType;
}

model MiddleType {
  value: RecursiveType;
}

model RecursiveType {
  value: MiddleType;
}

@@access(SerdeTests.BytesVectors, Access.public);
@@usage(SerdeTests.BytesVectors, Usage.output);
@@access(SerdeTests.BytesRecords, Access.public);
@@usage(SerdeTests.BytesRecords, Usage.output);
@@access(SerdeTests.BytesMixed, Access.public);
@@usage(SerdeTests.BytesMixed, Usage.output);

@@access(SerdeTests.RecursiveNullableType, Access.public);
@@usage(SerdeTests.RecursiveNullableType, Usage.output);
@@access(SerdeTests.OuterWithNullable, Access.public);
@@usage(SerdeTests.OuterWithNullable, Usage.output);

@@access(SerdeTests.OuterType, Access.public);
@@usage(SerdeTests.OuterType, Usage.output);
@@access(SerdeTests.MiddleType, Access.public);
@@usage(SerdeTests.MiddleType, Usage.output);
@@access(SerdeTests.RecursiveType, Access.public);
@@usage(SerdeTests.RecursiveType, Usage.output);

@@access(SerdeTests.OffsetDateTimeVectors, Access.public);
@@usage(SerdeTests.OffsetDateTimeVectors, Usage.output);
@@access(SerdeTests.OffsetDateTimeRecords, Access.public);
@@usage(SerdeTests.OffsetDateTimeRecords, Usage.output);
@@access(SerdeTests.OffsetDateTimeMixed, Access.public);
@@usage(SerdeTests.OffsetDateTimeMixed, Usage.output);
