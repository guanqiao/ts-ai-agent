#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { TypeScriptParser, JavaParser } from '../parsers';
import { AgentOrchestrator } from '../agents';
import { TemplateEngine } from '../generators';
import { WikiManager, WikiOptions, WikiContext } from '../wiki';
import { ArchitectureAnalyzer } from '../architecture';
import { HybridSearch } from '../search';
import { ConfigManager } from '../config';
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
        spinner.succeed(
          `Parsed ${parseResult.summary.totalFiles} files, ${parseResult.summary.totalSymbols} symbols`
        );
      }

      if (options.dryRun) {
        console.log(chalk.blue('\nParse Summary:'));
        console.log(JSON.stringify(parseResult.summary, null, 2));
        return;
      }

      if (!options.apiKey && !process.env.OPENAI_API_KEY) {
        spinner.fail(
          'API key required. Set OPENAI_API_KEY environment variable or use --api-key option'
        );
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

program
  .command('wiki')
  .description('Wiki management commands')
  .argument('<action>', 'Action to perform (init, generate, watch, query, export, architecture, sync, search, config)')
  .argument('[input]', 'Input directory path', '.')
  .option('-o, --output <path>', 'Output directory', './wiki')
  .option('-f, --format <format>', 'Output format (markdown, github-wiki, confluence)', 'markdown')
  .option('--llm <provider>', 'LLM provider (openai, anthropic)', 'openai')
  .option('--model <model>', 'LLM model name', 'gpt-4')
  .option('--api-key <key>', 'API key for LLM provider')
  .option('--base-url <url>', 'Base URL for LLM API')
  .option('--watch', 'Enable watch mode for auto-updates', false)
  .option('--query <question>', 'Query the wiki knowledge base')
  .option('--search <query>', 'Search wiki documents')
  .option('--max-results <n>', 'Maximum search results', '10')
  .option('--sync-start', 'Start auto sync', false)
  .option('--sync-stop', 'Stop auto sync', false)
  .option('--sync-status', 'Show sync status', false)
  .option('--show-config', 'Show current configuration', false)
  .option('--reset-config', 'Reset configuration to defaults', false)
  .action(async (action: string, input: string, options: any) => {
    const spinner = ora('Initializing Wiki...').start();

    try {
      const inputPath = path.resolve(input);
      const outputPath = path.resolve(options.output);

      if (!fs.existsSync(inputPath)) {
        spinner.fail(`Input path not found: ${inputPath}`);
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

      const wikiOptions: WikiOptions = {
        outputDir: outputPath,
        format: options.format as DocumentFormat,
        watchMode: options.watch,
        generateIndex: true,
        generateSearch: true,
      };

      const wikiManager = new WikiManager(llmConfig);
      await wikiManager.initialize(inputPath, wikiOptions);

      switch (action) {
        case 'init':
          await handleWikiInit(wikiManager, inputPath, outputPath, spinner);
          break;

        case 'generate':
          await handleWikiGenerate(wikiManager, inputPath, outputPath, options, spinner);
          break;

        case 'watch':
          await handleWikiWatch(wikiManager, spinner);
          break;

        case 'query':
          await handleWikiQuery(wikiManager, options.query, spinner);
          break;

        case 'export':
          await handleWikiExport(wikiManager, options.format, spinner);
          break;

        case 'architecture':
          await handleWikiArchitecture(inputPath, spinner);
          break;

        case 'sync':
          await handleWikiSync(wikiManager, options, spinner);
          break;

        case 'search':
          await handleWikiSearch(inputPath, options.search, options, spinner);
          break;

        case 'config':
          await handleWikiConfig(inputPath, options, spinner);
          break;

        default:
          spinner.fail(`Unknown wiki action: ${action}`);
          console.log(chalk.yellow('\nAvailable actions:'));
          console.log('  init         - Initialize wiki for a project');
          console.log('  generate     - Generate wiki documentation');
          console.log('  watch        - Watch for changes and auto-update');
          console.log('  query        - Query the wiki knowledge base');
          console.log('  export       - Export wiki to different formats');
          console.log('  architecture - Show architecture analysis');
          console.log('  sync         - Manage auto-sync (start/stop/status)');
          console.log('  search       - Search wiki documents');
          console.log('  config       - Manage wiki configuration');
          process.exit(1);
      }
    } catch (error) {
      spinner.fail('Wiki operation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

async function handleWikiInit(
  _wikiManager: WikiManager,
  inputPath: string,
  outputPath: string,
  spinner: any
): Promise<void> {
  spinner.text = 'Initializing wiki structure...';

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  const wikiDir = path.join(inputPath, '.wiki');
  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
  }

  spinner.succeed('Wiki initialized successfully');
  console.log(chalk.green('\n✓ Wiki structure created'));
  console.log(chalk.gray(`  Wiki directory: ${wikiDir}`));
  console.log(chalk.gray(`  Output directory: ${outputPath}`));
  console.log(chalk.blue('\nNext steps:'));
  console.log('  1. Run `tsd-gen wiki generate` to generate documentation');
  console.log('  2. Run `tsd-gen wiki watch` to enable auto-updates');
}

async function handleWikiGenerate(
  wikiManager: WikiManager,
  inputPath: string,
  outputPath: string,
  options: any,
  spinner: any
): Promise<void> {
  spinner.text = 'Parsing source code...';

  const parseResult = await parseInput(inputPath, { language: options.language || 'typescript' });

  if (parseResult.errors.length > 0) {
    spinner.warn(`Completed with ${parseResult.errors.length} parse errors`);
  } else {
    spinner.text = `Parsed ${parseResult.summary.totalFiles} files, ${parseResult.summary.totalSymbols} symbols`;
  }

  spinner.text = 'Analyzing architecture...';
  const architectureAnalyzer = new ArchitectureAnalyzer();
  const architecture = await architectureAnalyzer.analyze(parseResult.files);

  spinner.text = 'Generating wiki pages...';

  const context: WikiContext = {
    projectPath: inputPath,
    outputPath,
    parsedFiles: parseResult.files,
    architecture,
    options: {
      outputDir: outputPath,
      format: options.format as DocumentFormat,
      generateIndex: true,
      generateSearch: true,
    },
  };

  const document = await wikiManager.generate(context);

  spinner.succeed(`Wiki generated: ${document.pages.length} pages`);

  console.log(chalk.blue('\nGenerated Pages:'));
  document.pages.slice(0, 10).forEach((page) => {
    console.log(chalk.green(`  - ${page.title}`));
  });

  if (document.pages.length > 10) {
    console.log(chalk.gray(`  ... and ${document.pages.length - 10} more`));
  }

  console.log(chalk.green('\n✓ Done!'));
}

async function handleWikiWatch(wikiManager: WikiManager, spinner: any): Promise<void> {
  spinner.text = 'Starting watch mode...';

  wikiManager.watch((event) => {
    console.log(chalk.blue(`\n[${new Date().toISOString()}] ${event.type}`));
    if (event.details) {
      console.log(chalk.gray(JSON.stringify(event.details, null, 2)));
    }
  });

  spinner.succeed('Watch mode active. Press Ctrl+C to stop.');
  console.log(chalk.gray('Wiki will auto-update when code changes are detected.'));

  await new Promise(() => {});
}

async function handleWikiQuery(
  wikiManager: WikiManager,
  question: string | undefined,
  spinner: any
): Promise<void> {
  if (!question) {
    spinner.fail('Please provide a query with --query option');
    process.exit(1);
  }

  spinner.text = 'Querying wiki knowledge base...';

  const answer = await wikiManager.query(question);

  spinner.succeed('Query completed');

  console.log(chalk.blue('\nQuestion:'));
  console.log(`  ${question}`);

  console.log(chalk.blue('\nAnswer:'));
  console.log(`  ${answer.answer}`);

  if (answer.relatedPages.length > 0) {
    console.log(chalk.blue('\nRelated Pages:'));
    answer.relatedPages.forEach((pageId) => {
      console.log(chalk.gray(`  - ${pageId}`));
    });
  }

  console.log(chalk.gray(`\nConfidence: ${Math.round(answer.confidence * 100)}%`));
}

async function handleWikiExport(
  wikiManager: WikiManager,
  format: string,
  spinner: any
): Promise<void> {
  spinner.text = `Exporting wiki to ${format} format...`;

  const exportedFiles = await wikiManager.export(format as DocumentFormat);

  spinner.succeed(`Exported to ${format} format`);

  console.log(chalk.blue('\nExported Files:'));
  exportedFiles.split('\n').forEach((file) => {
    if (file.trim()) {
      console.log(chalk.green(`  ${file}`));
    }
  });
}

async function handleWikiArchitecture(inputPath: string, spinner: any): Promise<void> {
  spinner.text = 'Analyzing project architecture...';

  const parseResult = await parseInput(inputPath, { language: 'typescript' });

  const architectureAnalyzer = new ArchitectureAnalyzer();
  const architecture = await architectureAnalyzer.analyze(parseResult.files);

  spinner.succeed('Architecture analysis complete');

  console.log(chalk.blue('\n## Architecture Pattern'));
  console.log(`  Pattern: ${chalk.green(architecture.pattern.pattern)}`);
  console.log(`  Confidence: ${Math.round(architecture.pattern.confidence * 100)}%`);

  if (architecture.pattern.indicators.length > 0) {
    console.log(chalk.blue('\n  Indicators:'));
    architecture.pattern.indicators.slice(0, 5).forEach((indicator) => {
      console.log(chalk.gray(`    - ${indicator}`));
    });
  }

  console.log(chalk.blue('\n## Metrics'));
  console.log(`  Total Modules: ${architecture.metrics.totalModules}`);
  console.log(`  Total Classes: ${architecture.metrics.totalClasses}`);
  console.log(`  Total Functions: ${architecture.metrics.totalFunctions}`);
  console.log(`  Total Interfaces: ${architecture.metrics.totalInterfaces}`);
  console.log(`  Average Cohesion: ${(architecture.metrics.averageCohesion * 100).toFixed(1)}%`);
  console.log(`  Average Coupling: ${architecture.metrics.averageCoupling.toFixed(1)}`);
  console.log(`  Circular Dependencies: ${architecture.metrics.circularDependencies}`);
  console.log(`  Max Dependency Depth: ${architecture.metrics.maxDependencyDepth}`);

  if (architecture.layers.length > 0) {
    console.log(chalk.blue('\n## Layers'));
    architecture.layers.forEach((layer) => {
      console.log(chalk.green(`  ${layer.name}`));
      console.log(chalk.gray(`    Modules: ${layer.modules.length}`));
    });
  }

  if (architecture.recommendations.length > 0) {
    console.log(chalk.blue('\n## Recommendations'));
    architecture.recommendations.forEach((rec) => {
      console.log(chalk.yellow(`  - ${rec}`));
    });
  }
}

async function handleWikiSync(wikiManager: WikiManager, options: any, spinner: any): Promise<void> {
  if (options.syncStart) {
    spinner.text = 'Starting auto-sync...';
    await wikiManager.startAutoSync();
    spinner.succeed('Auto-sync started');
    console.log(chalk.green('\n✓ Auto-sync is now running'));
    console.log(chalk.gray('  Wiki will automatically update on code changes'));
  } else if (options.syncStop) {
    spinner.text = 'Stopping auto-sync...';
    wikiManager.stopAutoSync();
    spinner.succeed('Auto-sync stopped');
    console.log(chalk.green('\n✓ Auto-sync has been stopped'));
  } else if (options.syncStatus) {
    spinner.text = 'Getting sync status...';
    const status = wikiManager.getAutoSyncStatus();
    const health = await wikiManager.getSyncHealth();
    spinner.succeed('Sync status retrieved');

    console.log(chalk.blue('\n## Sync Status'));
    console.log(`  Is Synced: ${status.isSynced ? chalk.green('Yes') : chalk.yellow('No')}`);
    console.log(`  Last Sync: ${status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Never'}`);
    console.log(`  Pending Changes: ${status.pendingChanges}`);
    console.log(`  Errors: ${status.errors.length}`);

    console.log(chalk.blue('\n## Sync Health'));
    console.log(`  Score: ${health.score}/100`);
    console.log(`  Status: ${health.status === 'healthy' ? chalk.green(health.status) : health.status === 'warning' ? chalk.yellow(health.status) : chalk.red(health.status)}`);
    console.log(`  Message: ${health.message}`);

    if (status.outdatedPages.length > 0) {
      console.log(chalk.blue('\n## Outdated Pages'));
      status.outdatedPages.slice(5).forEach((page) => {
        console.log(chalk.yellow(`  - ${page.pageTitle} (${page.severity})`));
      });
      if (status.outdatedPages.length > 5) {
        console.log(chalk.gray(`  ... and ${status.outdatedPages.length - 5} more`));
      }
    }
  } else {
    spinner.info('Use --sync-start, --sync-stop, or --sync-status');
  }
}

async function handleWikiSearch(inputPath: string, query: string | undefined, options: any, spinner: any): Promise<void> {
  if (!query) {
    spinner.fail('Please provide a search query with --search option');
    process.exit(1);
  }

  spinner.text = 'Searching wiki documents...';

  const searchEngine = new HybridSearch();
  const maxResults = parseInt(options.maxResults) || 10;

  const wikiDir = path.join(inputPath, '.wiki', 'pages');
  if (!fs.existsSync(wikiDir)) {
    spinner.fail('Wiki not initialized. Run `tsd-gen wiki generate` first.');
    process.exit(1);
  }

  const pageFiles = fs.readdirSync(wikiDir).filter((f) => f.endsWith('.json'));
  const documents = pageFiles.map((file) => {
    const content = fs.readFileSync(path.join(wikiDir, file), 'utf-8');
    const page = JSON.parse(content);
    return {
      id: page.id,
      content: page.content,
      metadata: {
        pageId: page.id,
        title: page.title,
        category: page.metadata?.category || 'unknown',
        tags: page.metadata?.tags || [],
        wordCount: page.content.split(/\s+/).length,
      },
    };
  });

  await searchEngine.index(documents);

  const results = await searchEngine.search(query, {
    maxResults,
    threshold: 0.1,
    includeHighlights: true,
    keywordWeight: 0.4,
    semanticWeight: 0.6,
  });

  spinner.succeed(`Found ${results.length} results`);

  console.log(chalk.blue('\n## Search Results'));
  console.log(chalk.gray(`Query: "${query}"\n`));

  if (results.length === 0) {
    console.log(chalk.yellow('No results found'));
    return;
  }

  results.forEach((result, index) => {
    console.log(chalk.green(`${index + 1}. ${result.document.metadata.title}`));
    console.log(chalk.gray(`   Score: ${result.score.toFixed(3)} (${result.searchType})`));
    if (result.highlights && result.highlights.length > 0) {
      console.log(chalk.gray(`   Preview: ${result.highlights[0].snippet.substring(0, 100)}...`));
    }
    console.log();
  });
}

async function handleWikiConfig(inputPath: string, options: any, spinner: any): Promise<void> {
  const configManager = new ConfigManager(inputPath);

  if (options.resetConfig) {
    spinner.text = 'Resetting configuration...';
    await configManager.reset();
    spinner.succeed('Configuration reset to defaults');
    console.log(chalk.green('\n✓ Configuration has been reset'));
    return;
  }

  if (options.showConfig) {
    spinner.text = 'Loading configuration...';
    const config = await configManager.load();
    spinner.succeed('Configuration loaded');

    console.log(chalk.blue('\n## Current Configuration'));
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  spinner.text = 'Loading configuration...';
  const config = await configManager.load();
  spinner.succeed('Configuration loaded');

  console.log(chalk.blue('\n## Wiki Configuration'));
  console.log(chalk.green('\nProject:'));
  console.log(`  Name: ${config.project.name || path.basename(inputPath)}`);
  console.log(`  Language: ${config.project.language}`);
  console.log(`  Exclude: ${config.project.excludePatterns.slice(0, 3).join(', ')}...`);

  console.log(chalk.green('\nWiki:'));
  console.log(`  Output: ${config.wiki.outputDir}`);
  console.log(`  Format: ${config.wiki.format}`);
  console.log(`  Auto-sync: ${config.sync.autoSync}`);

  console.log(chalk.green('\nSearch:'));
  console.log(`  Enabled: ${config.search.enabled}`);
  console.log(`  Type: ${config.search.type}`);
  console.log(`  Max Results: ${config.search.maxResults}`);

  console.log(chalk.green('\nLLM:'));
  console.log(`  Model: ${config.llm.model}`);
  console.log(`  Temperature: ${config.llm.temperature}`);

  console.log(chalk.gray('\nUse --show-config for full configuration or --reset-config to reset to defaults'));
}

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
