import { generateCfihosFormatSql } from "./rdl-ingestion/generateCfihosFormatSql.ts";
import { WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/WaterDesalinationV2CfihosFormatProfile.ts";

process.stdout.write(generateCfihosFormatSql(WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE));
