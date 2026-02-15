#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { TypeScriptParser, JavaParser } from '../parsers';
import { AgentOrchestrator } from '../agents';
import { TemplateEngine } from '../generators';
import {
  GeneratorOptions,
  LLMProvider,
  DocumentFormat,
  Language,
  ParseResult,
  AgentContext,
  LLMConfig,
  SymbolKind,
} from '../types';

const program = new Command();

program
  .name('tsd-gen')
  .description('AI-powered Technical Documentation Generator')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate technical documentation from source code')
  .argument('<input>', 'Input file or directory path')
  .option('-o, --output <path>', 'Output directory', './docs')
  .option('-l, --language <lang>', 'Source language (typescript, java)', 'typescript')
  .option('-f, --format <format>', 'Output format (markdown, confluence, github-wiki)', 'markdown')
  .option('-t, --template <name>', 'Document template', 'api')
  .option('--llm <provider>', 'LLM provider (openai, anthropic)', 'openai')
  .option('--model <model>', 'LLM model name', 'gpt-4')
  .option('--api-key <key>', 'API key for LLM provider')
  .option('--base-url <url>', 'Base URL for LLM API')
  .option('--include-private', 'Include private members', false)
  .option('--verbose', 'Enable verbose output', false)
  .option('--dry-run', 'Parse only, do not generate documentation', false)
  .action(async (input: string, options: any) => {
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
        language: options.language as Language,
        format: options.format as DocumentFormat,
        template: options.template,
        llmProvider: options.llm as LLMProvider,
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
        spinner.succeed(`Parsed ${parseResult.summary.totalFiles} files, ${parseResult.summary.totalSymbols} symbols`);
      }

      if (options.dryRun) {
        console.log(chalk.blue('\nParse Summary:'));
        console.log(JSON.stringify(parseResult.summary, null, 2));
        return;
      }

      if (!options.apiKey && !process.env.OPENAI_API_KEY) {
        spinner.fail('API key required. Set OPENAI_API_KEY environment variable or use --api-key option');
        process.exit(1);
      }

      const llmConfig: LLMConfig = {
        provider: options.llm as LLMProvider,
        model: options.model,
        apiKey: options.apiKey || process.env.OPENAI_API_KEY,
        baseUrl: options.baseUrl,
        temperature: 0.7,
        maxTokens: 4096,
      };

      spinner.text = 'Generating documentation with AI...';

      const orchestrator = new AgentOrchestrator(llmConfig);
      const context: AgentContext = {
        parsedFiles: parseResult.files,
        options: generatorOptions,
        workingDirectory: process.cwd(),
      };

      const result = await orchestrator.run(context);

      spinner.text = 'Writing output files...';

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const outputFile = path.join(outputPath, 'README.md');
      fs.writeFileSync(outputFile, result.finalDocument);

      spinner.succeed(`Documentation generated: ${outputFile}`);

      if (options.verbose && result.review) {
        console.log(chalk.blue('\nReview Results:'));
        console.log(result.review.output);
      }

      console.log(chalk.green('\n✓ Done!'));
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('parse')
  .description('Parse source code and output structure')
  .argument('<input>', 'Input file or directory path')
  .option('-l, --language <lang>', 'Source language (typescript, java)', 'typescript')
  .option('--json', 'Output as JSON', false)
  .action(async (input: string, options: any) => {
    try {
      const inputPath = path.resolve(input);

      if (!fs.existsSync(inputPath)) {
        console.error(chalk.red(`Input path not found: ${inputPath}`));
        process.exit(1);
      }

      const parseResult = await parseInput(inputPath, options);

      if (options.json) {
        console.log(JSON.stringify(parseResult, null, 2));
      } else {
        console.log(chalk.blue('Parse Result:'));
        console.log(`Files: ${parseResult.summary.totalFiles}`);
        console.log(`Symbols: ${parseResult.summary.totalSymbols}`);
        console.log(`Time: ${parseResult.summary.parseTime}ms`);

        console.log(chalk.blue('\nBy Kind:'));
        Object.entries(parseResult.summary.byKind).forEach(([kind, count]) => {
          console.log(`  ${kind}: ${count}`);
        });

        if (parseResult.errors.length > 0) {
          console.log(chalk.yellow('\nErrors:'));
          parseResult.errors.forEach((err) => {
            console.log(`  ${err.file}: ${err.message}`);
          });
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('templates')
  .description('List available document templates')
  .action(() => {
    const templateEngine = new TemplateEngine();
    const templates = templateEngine.listTemplates();

    console.log(chalk.blue('Available Templates:\n'));
    templates.forEach((t) => {
      console.log(chalk.green(`  ${t.name}`));
      console.log(chalk.gray(`    ${t.description}`));
      console.log(chalk.gray(`    Sections: ${t.sections.map((s) => s.title).join(', ')}`));
      console.log();
    });
  });

async function parseInput(inputPath: string, options: any): Promise<ParseResult> {
  const language = options.language as Language;
  const stat = fs.statSync(inputPath);

  if (language === Language.Java) {
    const parser = new JavaParser();
    if (stat.isDirectory()) {
      return await parser.parseDirectory(inputPath);
    }
    const file = await parser.parse(inputPath);
    return {
      files: [file],
      summary: {
        totalFiles: 1,
        totalSymbols: file.symbols.length,
        byKind: {} as Record<SymbolKind, number>,
        byLanguage: { [Language.Java]: 1 } as Record<Language, number>,
        parseTime: file.parseTime || 0,
      },
      errors: [],
    };
  }

  const parser = new TypeScriptParser();
  if (stat.isDirectory()) {
    return await parser.parseDirectory(inputPath);
  }
  const file = await parser.parse(inputPath);
  return {
    files: [file],
    summary: {
      totalFiles: 1,
      totalSymbols: file.symbols.length,
      byKind: {} as Record<SymbolKind, number>,
      byLanguage: { [Language.TypeScript]: 1 } as Record<Language, number>,
      parseTime: file.parseTime || 0,
    },
    errors: [],
  };
}

program.parse();
