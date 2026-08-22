import { defineDataset } from "../src/servers/dataset";
import { PhoneType } from "../src/servers/types/phoneType";
import { EmailType } from "../src/servers/types/emailType";
import { DataServer, PassThroughTransformerSource } from "../src/query/dataserver";
import { Stage } from "../src/query/stage";
import { StreamCSVSource } from "../src/query/sources/streamCSV";
import { Transformation } from "../src/query/transformation";
import { BasicDeenthropyTransformer } from "../src/query/transformers/basicDeenthropyTransformer";

const dataset = defineDataset({
  name: "yandex_praktikum",
  version: "001",
  row: {
    yauid: {
      type: "Int64",
      nullable: true,
    },
    name: {
      type: "String",
      nullable: true,
    },
    email: EmailType.toDatasetType(),
    firstName: {
      type: "String",
      nullable: true,
    },
    lastName: {
      type: "String",
      nullable: true,
    },
    phone: PhoneType.toDatasetType(),
  },
  clickhouse: {
    database: "default",
    engine: "ReplacingMergeTree",
    primaryKey: ["email", "phone"],
    orderBy: ["email", "phone"],
    // uniqKeys: ['phone', 'email'],
    settings: {
      allow_nullable_key: 1,
    },
  },
});

export default dataset;

export async function importerFromFile(dataserver: DataServer) {
  const startTime = Date.now();
  let totalRows = 0;
  
  await dataserver
    .preview(3)
    .destinationBatch(async (rows) => {
      await dataserver.write(rows, {
        dataset: "yandex_praktikum",
      });
      totalRows += rows.length;
    }) // Теперь primaryKey берется автоматически из схемы датасета
    .call([
      new Stage(
        new StreamCSVSource(
          "/home/john/Downloads/Telegram Desktop/Яндекс Практикум.txt",
          "\t",
        ),
        new Transformation((it: any) => {
          const phone = it["phone_number"] ?? it["phone_number\r"];
          if (!phone || !it.email) {
            return null;
          }
          return {
            yauid: it.yauid,
            name: it.username,
            email: it.email,
            firstName: it.first_name,
            lastName: it.last_name,
            phone: phone,
          };
        }),
      ),
      new Stage(
        new PassThroughTransformerSource(),
        new BasicDeenthropyTransformer(),
      ),
    ]);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Import completed: ${totalRows} rows inserted in ${duration}s`);
}