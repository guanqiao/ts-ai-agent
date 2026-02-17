import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { TypeScriptParser, JavaParser } from '../../parsers';
import { AgentOrchestrator } from '../../agents';
import { TemplateEngine } from '../../generators';
import {
  GeneratorOptions,
  LLMConfig,
  LLMProvider,
  Language,
  DocumentFormat,
  ParseResult,
  AgentContext,
} from '../../types';
import { GenerateCommandOptions, parseLanguage, parseFormat, parseLLMProvider } from '../types';

export async function parseInput(
  inputPath: string,
  options: GenerateCommandOptions
): Promise<ParseResult> {
  const language = options.language;
  const parser = language === Language.Java ? new JavaParser() : new TypeScriptParser();

  const stat = fs.statSync(inputPath);

  if (stat.isDirectory()) {
    return parser.parseDirectory(inputPath);
  } else {
    const fileResult = await parser.parse(inputPath);
    return {
      files: [fileResult],
      summary: {
        totalFiles: 1,
        totalSymbols: fileResult.symbols.length,
        byKind: {} as Record<string, number>,
        byLanguage: { [language]: 1 } as Record<Language, number>,
        parseTime: 0,
      },
      errors: [],
    };
  }
}

export async function handleGenerateCommand(
  input: string,
  options: GenerateCommandOptions
): Promise<void> {
  const spinner = ora('Initializing...').start();

  try {
    const inputPath = path.resolve(input);
    const outputPath = path.resolve(options.output);

    if (!fs.existsSync(inputPath)) {
      spinner.fail(`Input path not found: ${inputPath}`);
      process.exit(1);
    }

    const generatorOptions: GeneratorOptions = {
      input: [inputPath],
      output: outputPath,
      language: options.language,
      format: options.format,
      template: options.template,
      llmProvider: options.llm,
      llmModel: options.model,
      includePrivate: options.includePrivate,
      verbose: options.verbose,
    };

    spinner.text = 'Parsing source code...';
    const parseResult = await parseInput(inputPath, options);

    if (parseResult.errors.length > 0) {
      spinner.warn(`Completed with ${parseResult.errors.length} errors`);
      parseResult.errors.forEach((err) => {
        console.log(chalk.yellow(`  ${err.file}: ${err.message}`));
      });
    } else {
      spinner.succeed(
        `Parsed ${parseResult.summary.totalFiles} files, ${parseResult.summary.totalSymbols} symbols`
      );
    }

    if (options.dryRun) {
      console.log(chalk.blue('\nParse Summary:'));
      console.log(JSON.stringify(parseResult.summary, null, 2));
      return;
    }

    const llmConfig: LLMConfig = {
      provider: options.llm,
      model: options.model,
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      baseUrl: options.baseUrl,
      temperature: 0.7,
      maxTokens: 4096,
      caCert: options.caCert,
    };

    spinner.text = 'Generating documentation...';

    const orchestrator = new AgentOrchestrator(llmConfig);

    const context: AgentContext = {
      parsedFiles: parseResult.files,
      options: generatorOptions,
      workingDirectory: process.cwd(),
    };

    const result = await orchestrator.run(context, {
      enablePlanning: false,
      parallelExecution: false,
      verbose: options.verbose,
    });

    if (result.analysis.success && result.generation.success) {
      spinner.succeed('Documentation generated successfully');

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const outputFile = path.join(outputPath, 'documentation.md');
      fs.writeFileSync(outputFile, result.finalDocument);

      console.log(chalk.green(`\nDocumentation saved to: ${outputFile}`));

      if (options.verbose) {
        console.log(chalk.blue('\nGeneration Details:'));
        console.log(chalk.gray(`  Input files: ${parseResult.summary.totalFiles}`));
        console.log(chalk.gray(`  Symbols processed: ${parseResult.summary.totalSymbols}`));
        console.log(chalk.gray(`  Output format: ${options.format}`));
      }
    } else {
      spinner.fail('Documentation generation failed');
      if (!result.analysis.success) {
        console.log(chalk.red(`Analysis error: ${result.analysis.error}`));
      }
      if (!result.generation.success) {
        console.log(chalk.red(`Generation error: ${result.generation.error}`));
      }
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`Error: ${(error as Error).message}`);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

export function buildGenerateOptions(options: Record<string, unknown>): GenerateCommandOptions {
  return {
    output: (options.output as string) || './docs',
    language: parseLanguage((options.language as string) || 'typescript'),
    format: parseFormat((options.format as string) || 'markdown'),
    template: (options.template as string) || 'api',
    llm: parseLLMProvider((options.llm as string) || 'openai'),
    model: (options.model as string) || 'gpt-4',
    apiKey: options.apiKey as string | undefined,
    baseUrl: options.baseUrl as string | undefined,
    caCert: options.caCert as string | undefined,
    includePrivate: (options.includePrivate as boolean) || false,
    dryRun: (options.dryRun as boolean) || false,
    verbose: (options.verbose as boolean) || false,
  };
}
