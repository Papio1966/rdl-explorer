import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

import {
  getRdlDatabaseConfig
} from "../server/db/config.ts";

import {
  PsqlJsonClient
} from "../server/db/PsqlJsonClient.ts";

import {
  closeRdlDatabaseClient
} from "../server/db/runtime.ts";

import {
  PublishedPackageDistributionRepository
} from "../server/rdl/PublishedPackageDistributionRepository.ts";


const RELEASE_ID=21;

const ORIGINAL_V1_SHA=
  "b7c1a0005e8d5ee1b778d7a9e2099edd4d4b688a0907b1579f9ba9ff14678e27";

const db=
  new PsqlJsonClient(
    getRdlDatabaseConfig().connectionString
  );


try{
  const repository=
    new PublishedPackageDistributionRepository(
      db
    );

  const pkg:any=
    await repository.consumerPackage(
      RELEASE_ID
    );

  assert.ok(pkg);

  assert.equal(
    pkg.schemaVersion,
    "rdl-distribution-package/v1"
  );

  assert.equal(
    pkg.distributionSha256,
    ORIGINAL_V1_SHA
  );

  assert.equal(
    pkg.effectiveEntities.length,
    16827
  );

  assert.equal(
    pkg.effectiveRelationships.length,
    49192
  );

  assert.ok(
    !Object.prototype.hasOwnProperty.call(
      pkg.effectiveEntities[0],
      "normalizedMetadata"
    )
  );

  console.log(
    "V1_DISTRIBUTION_IMMUTABILITY=PASS"
  );


  const details=
    await repository.entityDetails(
      RELEASE_ID
    );

  assert.equal(
    details.length,
    16827
  );

  const discipline=
    details.find(
      e=>
        e.entityType==="discipline"
        &&
        e.nativeIdentifier===
          "CFIHOS-20000001"
    );

  assert.equal(
    discipline
      ?.normalizedMetadata
      ?.code,
    "AA"
  );


  const documentType=
    details.find(
      e=>
        e.entityType==="document_type"
        &&
        e.nativeIdentifier===
          "CFIHOS-70000004"
    );

  assert.equal(
    documentType
      ?.normalizedMetadata
      ?.shortCode,
    "4301"
  );

  assert.equal(
    documentType
      ?.normalizedMetadata
      ?.classification,
    "DOCT"
  );


  const uom=
    details.find(
      e=>
        e.entityType==="unit_of_measure"
        &&
        e.nativeIdentifier===
          "CFIHOS-60000001"
    );

  assert.equal(
    uom?.normalizedMetadata?.symbol,
    "%"
  );

  assert.equal(
    uom?.normalizedMetadata?.uneceCode,
    "P1"
  );


  const body={
    schemaVersion:
      "rdl-distribution-entity-details/v1",
    releaseId:RELEASE_ID,
    items:details
  };

  const detailsSha256=
    createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");

  assert.match(
    detailsSha256,
    /^[0-9a-f]{64}$/
  );

  const bytes=
    Buffer.byteLength(
      JSON.stringify({
        ...body,
        detailsSha256
      }),
      "utf8"
    );

  assert.ok(
    bytes<32*1024*1024
  );

  console.log(
    `ENTITY_DETAIL_COUNT=${details.length}`
  );

  console.log(
    `ENTITY_DETAIL_BYTES=${bytes}`
  );

  console.log(
    `ENTITY_DETAIL_MIB=${(
      bytes/1024/1024
    ).toFixed(3)}`
  );

  console.log(
    `ENTITY_DETAILS_SHA256=${detailsSha256}`
  );


  const api=
    readFileSync(
      "api/distribution/entities.ts",
      "utf8"
    );

  assert.ok(
    api.includes(
      "rdl-distribution-entities/v1"
    )
  );

  assert.ok(
    api.includes(
      "rdl-distribution-entity-details/v1"
    )
  );

  assert.ok(
    api.includes(
      "request.query?.detail"
    )
  );

  console.log(
    "RDL_S035_STAGE_02F2C1_CONTRACT=PASS"
  );

}finally{
  await closeRdlDatabaseClient();
}
