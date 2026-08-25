import { CCUS_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusCfihosFormatProfile.ts";
import { generateCfihosFormatSql } from "./rdl-ingestion/generateCfihosFormatSql.ts";

process.stdout.write(generateCfihosFormatSql(CCUS_CFIHOS_FORMAT_PROFILE));
