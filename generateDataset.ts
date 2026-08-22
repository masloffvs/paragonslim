#!/usr/bin/env bun
import "reflect-metadata";
import { Command } from "commander";
import { createReadStream, writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { GoogleGenAI } from "@google/genai";
import $logger from "./src/pino";
import { FIELD_MAPPINGS } from "./src/query/utils/keyUtils";

const program = new Command();

program
  .name("generateDataset")
  .description("Generate dataset definition from file using Google AI")
  .option("--apiKey <key>", "Google AI Studio API key")
  .option("--file <path>", "Path to the file to analyze")
  .option("--output <path>", "Output path for generated dataset file", "./datasets/generated.ts")
  .option("--sample-size <number>", "Number of lines to sample from file", "100")
  .parse();

const options = program.opts();

const apiKey = options.apiKey || process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  $logger.error("Error: --apiKey is required or set GOOGLE_AI_API_KEY environment variable");
  $logger.error("Get your API key from: https://makersuite.google.com/app/apikey");
  process.exit(1);
}

if (!options.file) {
  $logger.error("Error: --file is required");
  process.exit(1);
}

async function generateDataset() {
  try {
    $logger.info(`Analyzing file: ${options.file}`);
    
    // Read sample from file
    const sample = await readFileSample(options.file, parseInt(options.sampleSize));
    $logger.info(`Sampled ${sample.lines.length} lines from file`);
    $logger.debug("Sample content preview:");
    $logger.debug(sample.content.substring(0, 500) + "...");
    
    // Initialize Google AI
    const ai = new GoogleGenAI({ apiKey });
    
    // Generate prompt
    const prompt = createPrompt(sample.content, options.file);
    
    $logger.info("Generating dataset definition...");
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      
      const generatedCode = response.text;
      
      $logger.debug("Google AI response received");
      
      if (!generatedCode || generatedCode.trim() === "") {
        throw new Error("Empty response from Google AI");
      }
      
      $logger.debug("Generated code preview:");
      $logger.debug(generatedCode.substring(0, 500) + "...");
      
      // Clean up the response (remove markdown code blocks if present)
      const cleanedCode = cleanGeneratedCode(generatedCode);
      
      // Write to output file
      writeOutputFile(options.output, cleanedCode);
      
      $logger.info(`Dataset definition generated successfully: ${options.output}`);
    } catch (aiError) {
      $logger.error("Google AI API error:", aiError);
      if (aiError instanceof Error) {
        $logger.error("AI Error message:", aiError.message);
        $logger.error("AI Error stack:", aiError.stack);
      } else {
        $logger.error("AI Error details:", String(aiError));
      }
      throw aiError;
    }
  } catch (error) {
    $logger.error("Error generating dataset:", error);
    if (error instanceof Error) {
      $logger.error("Error message:", error.message);
      $logger.error("Error stack:", error.stack);
    } else {
      $logger.error("Error details:", String(error));
    }
    process.exit(1);
  }
}

async function readFileSample(filePath: string, sampleSize: number): Promise<{ lines: string[], content: string }> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    let lineCount = 0;
    
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    
    stream.on('data', (chunk: string) => {
      const chunkLines = chunk.split('\n');
      for (const line of chunkLines) {
        if (lineCount >= sampleSize) break;
        if (line.trim() !== '') {
          lines.push(line);
          lineCount++;
        }
      }
      
      if (lineCount >= sampleSize) {
        stream.destroy();
        resolve({
          lines,
          content: lines.join('\n')
        });
      }
    });
    
    stream.on('end', () => {
      resolve({
        lines,
        content: lines.join('\n')
      });
    });
    
    stream.on('error', (error) => {
      $logger.error("Stream error:", error);
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      stream.destroy();
      if (lines.length > 0) {
        resolve({
          lines,
          content: lines.join('\n')
        });
      } else {
        reject(new Error("File read timeout"));
      }
    }, 10000);
  });
}

function getTypesContent(): string {
  try {
    const files = readdirSync("./src/servers/types");
    let content = "";
    for (const file of files) {
      if (file.endsWith(".ts")) {
        const fileContent = readFileSync(join("./src/servers/types", file), "utf8");
        content += `\n// --- src/servers/types/${file} ---\n${fileContent}\n`;
      }
    }
    return content;
  } catch (e) {
    return "";
  }
}

function getSystemSourceContent(): string {
  const filesToRead = [
    "./datasets/yandexPracticumFinal.ts",
    "./src/query/dataserver.ts",
    "./src/query/sources/streamCSV.ts",
    "./src/query/stage.ts",
    "./src/query/transformation.ts",
    "./src/query/sources/passThroughTransformer.ts",
    "./src/query/transformers/basicDeenthropyTransformer.ts",
  ];
  let content = "";
  for (const file of filesToRead) {
    try {
      if (existsSync(file)) {
        const fileContent = readFileSync(file, "utf8");
        content += `\n// --- ${file} ---\n${fileContent}\n`;
      }
    } catch (e) {
      // ignore
    }
  }
  return content;
}

function createPrompt(sampleContent: string, fileName: string): string {
  const typesContent = getTypesContent();
  const systemSourceContent = getSystemSourceContent();
  const fieldMappingStr = JSON.stringify(FIELD_MAPPINGS, null, 2);

  return `You are a data engineering expert. Analyze the following file sample and generate a TypeScript dataset definition file that includes both the dataset definition and the importer function.

File: ${fileName}
Sample content:
\`\`\`
${sampleContent}
\`\`\`

Available Field Mapping Dictionary (from src/query/utils/keyUtils.ts):
\`\`\`json
${fieldMappingStr}
\`\`\`

Available Dataset Types & Helpers (from src/servers/types/):
\`\`\`typescript
${typesContent}
\`\`\`

System Source Files Reference (examples of dataset definitions and importers):
\`\`\`typescript
${systemSourceContent}
\`\`\`

Generate a TypeScript file that:
1. Infers the data structure from the sample
2. Uses the field mapping dictionary to normalize field names to their canonical camelCase form (e.g. use "phone" or "phon" -> "phone" instead of "phoneNumber" or "phone_number", "email" instead of "email_address", etc.)
3. Uses specialized dataset type methods with .toDatasetType() when available in src/servers/types (e.g., phone: PhoneType.toDatasetType(), email: EmailType.toDatasetType(), age: AgeType.toDatasetType()), importing them appropriately from "../src/servers/types/..."
4. Falls back to standard RowValueType ("String", "Int64", "Float64", "DateTime", "Boolean", "UUID") for other fields
5. **CRITICAL / RESERVED**: NEVER use "id" as a row field name in \`row\` (do NOT define \`id: { type: ... }\` in \`row\`), because row name \`"id"\` is reserved and throws a runtime error (\`Row with name 'id' is reserved and cannot be used\`). If the data has an id column, skip it or name it something else (like \`userId\`,\`recordId\`, \`yauid\`, etc.). However, "id" or other fields can be used in \`clickhouse.orderBy\`.
  6. Sets up ClickHouse configuration using the ClickHouseConfig format. **CRITICAL**: If any column in \`orderBy\` is \`nullable: true\`, add \`settings: { allow_nullable_key: 1 }\` to the \`clickhouse\` config to avoid ClickHouse error \"Sorting key contains nullable columns\".
  7. **ORDER BY CHOICE**: Prefer a stable, high-cardinality column for \`orderBy\` (e.g. an Int64 id, UUID, or timestamp). Avoid using mutable String columns like phone or email as \`orderBy\`.
  8. Do NOT use \`uniqKeys\` - ClickHouse does not support \`ALTER TABLE ... ADD CONSTRAINT ... UNIQUE\` reliably, and uniqueness is not required at the storage layer.
  9. Uses the dataset.defineDataset format
  10. **IMPORTER FUNCTION**: Generates \`export async function importerFromFile(dataserver: DataServer)\` following the exact pattern from \`datasets/yandexPracticumFinal.ts\`:
      - Uses \`dataserver.destinationBatch((rows) => { dataserver.write(rows, { dataset: "dataset_name" }); }, batchSize)\` instead of \`destination\` for batched writes (recommended batchSize: 100)
      - Calls \`await dataserver.preview(3).destinationBatch(...).call([ ... ])\`
   - Uses \`StreamCSVSource\` with the file path (\`${fileName}\`) and delimiter (e.g. \`"\\t"\` for tab-separated or \`","\` for comma-separated based on sample content).
   - Uses \`Transformation\` to map raw headers/columns to normalized row fields (handling any trailing carriage returns like \`\\r\` in CSV headers if present).
   - Uses second stage: \`new Stage(new PassThroughTransformerSource(), new BasicDeenthropyTransformer())\`.
   - Imports all required modules correctly (\`defineDataset\`, \`DataServer\`, \`PassThroughTransformerSource\`, \`Stage\`, \`StreamCSVSource\`, \`Transformation\`, \`BasicDeenthropyTransformer\`, and type methods).

IMPORTANT: Use the exact format specified below.

Return ONLY the TypeScript code without any explanations or markdown formatting. The code should be ready to be saved as a .ts file in the datasets directory.

Format:
\`\`\`typescript
import { defineDataset } from "../src/servers/dataset";
import { PhoneType } from "../src/servers/types/phoneType";
import { EmailType } from "../src/servers/types/emailType";
import { AgeType } from "../src/servers/types/ageType";
import { DataServer, PassThroughTransformerSource } from "../src/query/dataserver";
import { Stage } from "../src/query/stage";
import { StreamCSVSource } from "../src/query/sources/streamCSV";
import { Transformation } from "../src/query/transformation";
import { BasicDeenthropyTransformer } from "../src/query/transformers/basicDeenthropyTransformer";

const dataset = defineDataset({
  name: "dataset_name",
  version: "001",
  row: {
    fieldName: {
      type: "String", // or "Int64", "Float64", "DateTime", "Boolean", "UUID"
      nullable: true
    },
    phone: PhoneType.toDatasetType()
  },
  clickhouse: {
    database: "default",
    engine: "MergeTree",
    orderBy: ["yauid"]
  }
});

export default dataset;

export async function importerFromFile(dataserver: DataServer) {
  await dataserver
    .preview(3)
    .destinationBatch((rows) => {
      dataserver.write(rows, {
        dataset: "dataset_name",
      });
    }, 100)
    .call([
      new Stage(
        new StreamCSVSource(
          "${fileName}",
          ",",
        ),
        new Transformation((it: any) => {
          return {
            // mapped fields
          };
        }),
      ),
      new Stage(
        new PassThroughTransformerSource(),
        new BasicDeenthropyTransformer(),
      ),
    ]);
}
\`\`\``;
}

function cleanGeneratedCode(code: string): string {
  // Remove markdown code blocks if present
  let cleaned = code;
  
  // Remove ```typescript and ``` markers
  cleaned = cleaned.replace(/```typescript/g, '');
  cleaned = cleaned.replace(/```/g, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

function writeOutputFile(filePath: string, content: string): void {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(filePath, content, 'utf8');
}

generateDataset();
