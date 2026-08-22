import { defineDataset } from "../src/servers/dataset";
import { DataServer, PassThroughTransformerSource } from "../src/query/dataserver";
import { Stage } from "../src/query/stage";
import { StreamCSVSource } from "../src/query/sources/streamCSV";
import { BasicDeenthropyTransformer } from "../src/query/transformers/basicDeenthropyTransformer";
import { Transformer } from "../src/query/transformers/transformer";
import { Transformation } from "../src/query/transformation";

export default defineDataset({
  name: "TestTable",
  version: "001",
  row: {
    name: {
      name: "Name of user",
      type: "String",
    },
    age: {
      name: "Age of user",
      type: "Int64",
    },
    createdAt: {
      name: "Creation timestamp",
      type: "DateTime",
    },
  },
  clickhouse: {
    database: "mydb",
    engine: "MergeTree",
    orderBy: ["createdAt"],
    partitionBy: "toYYYYMM(createdAt)",
  },
});

export async function importerFromFile(dataserver: DataServer) {
  await dataserver.call([
    new Stage(
      new StreamCSVSource(
        "/home/john/Downloads/Telegram Desktop/Яндекс Практикум.txt",
      ),
      new Transformation(it => {
        
      }),
    ),
    new Stage(
      new PassThroughTransformerSource(),
      new BasicDeenthropyTransformer(),
    ),
  ]);
}
