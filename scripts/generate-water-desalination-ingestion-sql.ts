import { generateCfihosFormatSql } from "./rdl-ingestion/generateCfihosFormatSql.ts";
import { WATER_DESALINATION_PROFILE } from "./rdl-ingestion/WaterDesalinationProfile.ts";

process.stdout.write(await generateCfihosFormatSql(WATER_DESALINATION_PROFILE));
