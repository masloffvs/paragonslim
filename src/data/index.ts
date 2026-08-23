import StreamedCSV from "./streams/CSV";

export class Data {
  public readonly stream: {
    csv: typeof StreamedCSV;
  } = {
    csv: StreamedCSV,
  };
}

const $data = new Data();
export default $data;