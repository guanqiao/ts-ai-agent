import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { TypeScriptParser, JavaParser } from '../../parsers';
import { Language, ParseResult } from '../../types';
import { ParseCommandOptions, parseLanguage } from '../types';

export async function handleParseCommand(
  input: string,
  options: ParseCommandOptions
): Promise<void> {
  const spinner = ora('Parsing source code...').start();

  try {
    const inputPath = path.resolve(input);

    if (!fs.existsSync(inputPath)) {
      spinner.fail(`Input path not found: ${inputPath}`);
      process.exit(1);
    }

    const language = options.language;
    const parser = language === Language.Java ? new JavaParser() : new TypeScriptParser();

    let result: ParseResult;

    const stat = fs.statSync(inputPath);
    if (stat.isDirectory()) {
      result = await parser.parseDirectory(inputPath);
    } else {
      const fileResult = await parser.parse(inputPath);
      result = {
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

    if (result.errors.length > 0) {
      spinner.warn(`Completed with ${result.errors.length} errors`);
      result.errors.forEach((err) => {
        console.log(chalk.yellow(`  ${err.file}: ${err.message}`));
      });
    } else {
      spinner.succeed(
        `Parsed ${result.summary.totalFiles} files, ${result.summary.totalSymbols} symbols`
      );
    }

    let output: string;

    switch (options.format) {
      case 'json':
        output = JSON.stringify(result, null, 2);
        break;
      case 'yaml':
        output = convertToYaml(result);
        break;
      case 'markdown':
        output = convertToMarkdown(result);
        break;
      default:
        output = JSON.stringify(result, null, 2);
    }

    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, output);
      console.log(chalk.green(`\nOutput saved to: ${outputPath}`));
    } else {
      console.log('\n' + output);
    }

    if (options.verbose) {
      console.log(chalk.blue('\nParse Summary:'));
      console.log(chalk.gray(`  Total files: ${result.summary.totalFiles}`));
      console.log(chalk.gray(`  Total symbols: ${result.summary.totalSymbols}`));
      console.log(chalk.gray(`  Language: ${language}`));
    }
  } catch (error) {
    spinner.fail(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

function convertToYaml(result: ParseResult): string {
  const lines: string[] = [];

  lines.push('files:');
  for (const file of result.files) {
    lines.push(`  - path: "${file.path}"`);
    lines.push(`    symbols:`);
    for (const symbol of file.symbols) {
      lines.push(`      - name: "${symbol.name}"`);
      lines.push(`        kind: "${symbol.kind}"`);
      if (symbol.description) {
        lines.push(`        description: "${symbol.description}"`);
      }
    }
  }

  lines.push('summary:');
  lines.push(`  totalFiles: ${result.summary.totalFiles}`);
  lines.push(`  totalSymbols: ${result.summary.totalSymbols}`);

  return lines.join('\n');
}

function convertToMarkdown(result: ParseResult): string {
  const lines: string[] = [];

  lines.push('# Parse Result\n');

  lines.push('## Summary\n');
  lines.push(`- **Total Files**: ${result.summary.totalFiles}`);
  lines.push(`- **Total Symbols**: ${result.summary.totalSymbols}`);
  lines.push('');

  lines.push('## Files\n');
  for (const file of result.files) {
    lines.push(`### ${file.path}\n`);
    if (file.symbols.length > 0) {
      lines.push('| Name | Kind | Description |');
      lines.push('|------|------|-------------|');
      for (const symbol of file.symbols) {
        lines.push(
          `| ${symbol.name} | ${symbol.kind} | ${symbol.description || '-'} |`
        );
      }
      lines.push('');
    }
  }

  if (result.errors.length > 0) {
    lines.push('## Errors\n');
    for (const error of result.errors) {
      lines.push(`- **${error.file}**: ${error.message}`);
    }
  }

  return lines.join('\n');
}

export function buildParseOptions(options: Record<string, unknown>): ParseCommandOptions {
  return {
    output: options.output as string | undefined,
    language: parseLanguage((options.language as string) || 'typescript'),
    format: (options.format as 'json' | 'yaml' | 'markdown') || 'json',
    includePrivate: (options.includePrivate as boolean) || false,
    verbose: (options.verbose as boolean) || false,
  };
}
