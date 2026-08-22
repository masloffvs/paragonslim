import { Command } from "commander";
import { injectable, singleton } from "tsyringe";
import { Logger } from "./pino";

export type OptionValueType = string | number | boolean | undefined;
export type Optionname = "port" | "host" | "serversConfig" | "volumesConfig" | "entrypoint" | "forceRecreateTable";

@injectable()
@singleton()
export class Cli {
  private program: Command;
  private importCommand: Command;

  constructor(private logger: Logger) {
    this.program = new Command();

    this.program
      .name("Paragon Mini")
      .description("CLI tool for Paragon Mini")
      .version("0.0.1")
      .option(
        "-s, --serversConfig <path>",
        "Path to the servers config file",
        "./servers.toml",
      )
      .option(
        "--volumesConfig <path>",
        "Path to the volumes config file",
        "./volumes.toml",
      )
      .option("-p, --port <number>", "Port to run the server on", "3011")
      .option("-h, --host <string>", "Host to run the server on", "localhost");

    this.importCommand = this.program
      .command("import:fromFile")
      .description("Import data from file for a specified dataset entrypoint")
      .option("-e, --entrypoint <string>", "Dataset entrypoint name")
      .option("--forceRecreateTable", "Drop table before import and recreate it");

    try {
      this.program.parse(process.argv);
      this.logger.debug(`Parsed options: ${JSON.stringify(this.program.opts())}`);
      console.log("DEBUG: Parsed options:", this.program.opts());
    } catch (e) {
      console.error("DEBUG: Parse error:", e);
      throw e;
    }
  }

  private valueToTyped<T>(value: string | undefined | any): T | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string") {
      return value as unknown as T;
    }

    const numberValue = Number(value);
    if (value.trim() !== "" && !isNaN(numberValue)) {
      return numberValue as unknown as T;
    }

    if (value.toLowerCase() === "true" || value.toLowerCase() === "yes") {
      return true as unknown as T;
    }

    if (value.toLowerCase() === "false" || value.toLowerCase() === "no") {
      return false as unknown as T;
    }

    return value as unknown as T;
  }

  getSubcommand(): string | undefined {
    if (this.program.args.includes("import:fromFile") || process.argv.includes("import:fromFile")) {
      return "import:fromFile";
    }
    return undefined;
  }

  isImportFromFile(): boolean {
    return this.getSubcommand() === "import:fromFile";
  }

  getOptionValue<T>(optionName: Optionname): T {
    let value: any = undefined;
    if (this.importCommand) {
      value = this.importCommand.getOptionValue(optionName as string);
    }
    if (value === undefined) {
      value = this.program.getOptionValue(optionName as string);
    }
    this.logger.debug(`Option value for ${optionName}: ${value}`);
    return this.valueToTyped<T>(value) as T;
  }
}
