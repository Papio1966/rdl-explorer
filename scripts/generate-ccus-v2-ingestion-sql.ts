import { CCUS_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusV2CfihosFormatProfile.ts";
import { generateCfihosFormatSql } from "./rdl-ingestion/generateCfihosFormatSql.ts";

process.stdout.write(await generateCfihosFormatSql(CCUS_V2_CFIHOS_FORMAT_PROFILE));
