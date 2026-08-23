import { defineDataset } from "../src/servers/dataset";
import { PhoneType } from "../src/servers/types/phoneType";
import { EmailType } from "../src/servers/types/emailType";
import { DataServer } from "../src/query/dataserver";
import { BasicDeenthropyTransformer } from "../src/query/transformers/basicDeenthropyTransformer";
import $data from "../src/data";

const dataset = defineDataset({
  name: "yandex_praktikum",
  version: "001",
  row: {
    id: {
      type: "Int64",
      nullable: false,
    },
    name: false,
    email: EmailType.toDatasetType(false),
    firstName: {
      type: "String",
      nullable: true,
    },
    lastName: {
      type: "String",
      nullable: true,
    },
    phone: PhoneType.toDatasetType(true),
  },
  clickhouse: {
    database: "default",
    engine: {
      name: "ReplacingMergeTree",
      version: "id",
    },
    settings: {
      allow_nullable_key: 1,
      storage_policy: "hot",
    },
  },
});

export default dataset;

export async function importerFromFile(dataserver: DataServer) {
  const stream = new $data.stream.csv({
    source: "/home/john/Downloads/Telegram Desktop/Яндекс Практикум.txt",
    delimiter: "\t",
  });

  const tranformator = new BasicDeenthropyTransformer();

  await stream.redirectToBatch(async it => {
    await dataserver.write(
      dataset,
      it
        .map((it) => stream.arrayToJsonWithKeys(it))
        .filter((it) => it != null)
        .map((it) => tranformator.transform(it)),
    );

    dataserver.optimize(dataset)
  }, 50_000)
}