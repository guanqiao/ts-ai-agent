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
  .option('--ca-cert <path>', 'Path to CA certificate file (optional)')
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
        caCert: options.caCert,
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
  .argument(
    '<action>',
    'Action to perform (init, generate, watch, query, export, architecture, sync, search, config, share, graph, adr, collab, impact)'
  )
  .argument('[input]', 'Input directory path', '.')
  .option('-o, --output <path>', 'Output directory', './wiki')
  .option('-f, --format <format>', 'Output format (markdown, github-wiki, confluence)', 'markdown')
  .option('--llm <provider>', 'LLM provider (openai, anthropic)', 'openai')
  .option('--model <model>', 'LLM model name', 'gpt-4')
  .option('--api-key <key>', 'API key for LLM provider')
  .option('--base-url <url>', 'Base URL for LLM API')
  .option('--ca-cert <path>', 'Path to CA certificate file (optional)')
  .option('--watch', 'Enable watch mode for auto-updates', false)
  .option('--query <question>', 'Query the wiki knowledge base')
  .option('--search <query>', 'Search wiki documents')
  .option('--max-results <n>', 'Maximum search results', '10')
  .option('--sync-start', 'Start auto sync', false)
  .option('--sync-stop', 'Stop auto sync', false)
  .option('--sync-status', 'Show sync status', false)
  .option('--show-config', 'Show current configuration', false)
  .option('--reset-config', 'Reset configuration to defaults', false)
  .option('--share-path <path>', 'Path for sharing wiki', './docs/wiki')
  .option('--share-access <level>', 'Access level (public, team, private)', 'team')
  .option('--graph-type <type>', 'Graph type (dependency, call, inheritance)', 'dependency')
  .option('--graph-format <format>', 'Graph format (mermaid, svg, json)', 'mermaid')
  .option('--adr-title <title>', 'ADR title')
  .option('--adr-context <context>', 'ADR context')
  .option('--adr-decision <decision>', 'ADR decision')
  .option('--adr-status <status>', 'ADR status (proposed, accepted, deprecated)', 'proposed')
  .option('--adr-id <id>', 'ADR ID')
  .option('--collab-user <user>', 'Collaborator username')
  .option('--collab-role <role>', 'Collaborator role (admin, editor, viewer)', 'editor')
  .option('--impact-file <file>', 'File path for impact analysis')
  .option('--impact-type <type>', 'Change type (added, modified, removed)', 'modified')
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
        caCert: options.caCert,
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

        case 'share':
          await handleWikiShare(wikiManager, options, spinner);
          break;

        case 'graph':
          await handleWikiGraph(wikiManager, inputPath, options, spinner);
          break;

        case 'adr':
          await handleWikiADR(wikiManager, options, spinner);
          break;

        case 'collab':
          await handleWikiCollab(wikiManager, options, spinner);
          break;

        case 'impact':
          await handleWikiImpact(wikiManager, options, spinner);
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
          console.log('  share        - Share wiki to Git repository');
          console.log('  graph        - Generate dependency/call/inheritance graphs');
          console.log('  adr          - Manage Architecture Decision Records');
          console.log('  collab       - Manage collaborators and permissions');
          console.log('  impact       - Analyze change impact');
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
    console.log(
      `  Last Sync: ${status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Never'}`
    );
    console.log(`  Pending Changes: ${status.pendingChanges}`);
    console.log(`  Errors: ${status.errors.length}`);

    console.log(chalk.blue('\n## Sync Health'));
    console.log(`  Score: ${health.score}/100`);
    console.log(
      `  Status: ${health.status === 'healthy' ? chalk.green(health.status) : health.status === 'warning' ? chalk.yellow(health.status) : chalk.red(health.status)}`
    );
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

async function handleWikiSearch(
  inputPath: string,
  query: string | undefined,
  options: any,
  spinner: any
): Promise<void> {
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

  console.log(
    chalk.gray('\nUse --show-config for full configuration or --reset-config to reset to defaults')
  );
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

async function handleWikiShare(wikiManager: WikiManager, options: any, spinner: any): Promise<void> {
  spinner.text = 'Initializing wiki sharing...';

  await wikiManager.initializeSharing({
    enabled: true,
    shareToGit: true,
    sharePath: options.sharePath,
    accessControl: options.shareAccess,
    syncWithRemote: true,
    autoCommit: true,
  });

  spinner.text = 'Sharing wiki...';
  const result = await wikiManager.shareWiki();

  if (result.success) {
    spinner.succeed('Wiki shared successfully');
    console.log(chalk.green('\n✓ Wiki has been shared'));
    console.log(chalk.gray(`  Path: ${options.sharePath}`));
    console.log(chalk.gray(`  Access: ${options.shareAccess}`));
    if (result.commitHash) {
      console.log(chalk.gray(`  Commit: ${result.commitHash}`));
    }
  } else {
    spinner.fail('Failed to share wiki');
    console.log(chalk.red(`  Errors: ${result.errors.map((e: any) => e.message).join(', ')}`));
  }
}

async function handleWikiGraph(
  wikiManager: WikiManager,
  inputPath: string,
  options: any,
  spinner: any
): Promise<void> {
  spinner.text = 'Generating graph...';

  const parseResult = await parseInput(inputPath, { language: 'typescript' });
  const graphType = options.graphType;
  const graphFormat = options.graphFormat;

  let graph: any;
  let graphName: string;

  switch (graphType) {
    case 'call':
      graph = await wikiManager.generateCallGraph(parseResult.files);
      graphName = 'Call Graph';
      break;
    case 'inheritance':
      graph = await wikiManager.generateInheritanceGraph(parseResult.files);
      graphName = 'Inheritance Graph';
      break;
    case 'dependency':
    default:
      graph = await wikiManager.generateDependencyGraph(parseResult.files);
      graphName = 'Dependency Graph';
  }

  let output: string;
  switch (graphFormat) {
    case 'svg':
      output = wikiManager.exportGraphToSVG(graph);
      break;
    case 'json':
      output = wikiManager.exportGraphToJSON(graph);
      break;
    case 'mermaid':
    default:
      output = wikiManager.exportGraphToMermaid(graph);
  }

  spinner.succeed(`${graphName} generated`);

  console.log(chalk.blue(`\n## ${graphName}`));
  console.log(chalk.gray(`Format: ${graphFormat}`));
  console.log(chalk.gray(`Nodes: ${graph.nodes.length}`));
  console.log(chalk.gray(`Edges: ${graph.edges.length}`));

  if (graphFormat === 'mermaid') {
    console.log(chalk.blue('\n## Mermaid Diagram'));
    console.log('```mermaid');
    console.log(output);
    console.log('```');
  } else {
    console.log(chalk.blue('\n## Output'));
    console.log(output.substring(0, 500) + (output.length > 500 ? '...' : ''));
  }

  const cycles = wikiManager.detectGraphCycles(graph);
  if (cycles.length > 0) {
    console.log(chalk.yellow('\n## Cycles Detected'));
    cycles.slice(0, 5).forEach((cycle: string[], index: number) => {
      console.log(chalk.yellow(`  ${index + 1}. ${cycle.join(' -> ')}`));
    });
    if (cycles.length > 5) {
      console.log(chalk.gray(`  ... and ${cycles.length - 5} more cycles`));
    }
  }
}

async function handleWikiADR(wikiManager: WikiManager, options: any, spinner: any): Promise<void> {
  if (options.adrTitle && options.adrContext && options.adrDecision) {
    spinner.text = 'Creating ADR...';
    const adr = await wikiManager.createADR(
      options.adrTitle,
      options.adrContext,
      options.adrDecision,
      'cli-user'
    );
    spinner.succeed('ADR created successfully');
    console.log(chalk.green('\n✓ ADR created'));
    console.log(chalk.gray(`  ID: ${adr.id}`));
    console.log(chalk.gray(`  Title: ${adr.title}`));
    console.log(chalk.gray(`  Status: ${adr.status}`));
    return;
  }

  if (options.adrId && options.adrStatus) {
    spinner.text = 'Updating ADR status...';
    let adr: any;
    switch (options.adrStatus) {
      case 'accepted':
        adr = await wikiManager.acceptADR(options.adrId, 'cli-user');
        break;
      case 'deprecated':
        adr = await wikiManager.deprecateADR(options.adrId, 'Status changed via CLI', 'cli-user');
        break;
      default:
        adr = await wikiManager.updateADR(options.adrId, { status: options.adrStatus });
    }
    spinner.succeed('ADR status updated');
    console.log(chalk.green('\n✓ ADR updated'));
    console.log(chalk.gray(`  ID: ${adr.id}`));
    console.log(chalk.gray(`  Status: ${adr.status}`));
    return;
  }

  if (options.adrId) {
    spinner.text = 'Fetching ADR...';
    const adr = await wikiManager.getADR(options.adrId);
    if (!adr) {
      spinner.fail('ADR not found');
      return;
    }
    spinner.succeed('ADR retrieved');
    console.log(chalk.blue('\n## ADR Details'));
    console.log(chalk.green(`ID: ${adr.id}`));
    console.log(chalk.green(`Title: ${adr.title}`));
    console.log(chalk.green(`Status: ${adr.status}`));
    console.log(chalk.green(`Date: ${adr.date.toISOString().split('T')[0]}`));
    console.log(chalk.blue('\nContext:'));
    console.log(adr.context);
    console.log(chalk.blue('\nDecision:'));
    console.log(adr.decision);
    return;
  }

  spinner.text = 'Listing ADRs...';
  const adrs = await wikiManager.listADRs();
  spinner.succeed(`Found ${adrs.length} ADRs`);

  console.log(chalk.blue('\n## Architecture Decision Records'));
  if (adrs.length === 0) {
    console.log(chalk.yellow('No ADRs found'));
    console.log(chalk.gray('\nCreate a new ADR with:'));
    console.log('  tsd-gen wiki adr --adr-title "Title" --adr-context "Context" --adr-decision "Decision"');
    return;
  }

  adrs.forEach((adr: any, index: number) => {
    const statusColor = adr.status === 'accepted' ? chalk.green : 
                       adr.status === 'deprecated' ? chalk.red : chalk.yellow;
    console.log(`${index + 1}. ${adr.title} ${statusColor(`[${adr.status}]`)}`);
    console.log(chalk.gray(`   ID: ${adr.id}`));
    console.log(chalk.gray(`   Date: ${adr.date.toISOString().split('T')[0]}`));
  });
}

async function handleWikiCollab(wikiManager: WikiManager, options: any, spinner: any): Promise<void> {
  if (options.collabUser && options.collabRole) {
    spinner.text = 'Adding collaborator...';
    const contributor = await wikiManager.addContributor(
      options.collabUser,
      `${options.collabUser}@example.com`,
      options.collabRole
    );
    spinner.succeed('Collaborator added');
    console.log(chalk.green('\n✓ Collaborator added'));
    console.log(chalk.gray(`  Name: ${contributor.name}`));
    console.log(chalk.gray(`  Role: ${contributor.role}`));
    return;
  }

  spinner.text = 'Listing collaborators...';
  const contributors = await wikiManager.getContributors();
  spinner.succeed(`Found ${contributors.length} collaborators`);

  console.log(chalk.blue('\n## Collaborators'));
  if (contributors.length === 0) {
    console.log(chalk.yellow('No collaborators found'));
    console.log(chalk.gray('\nAdd a collaborator with:'));
    console.log('  tsd-gen wiki collab --collab-user "username" --collab-role "editor"');
    return;
  }

  contributors.forEach((contributor: any, index: number) => {
    const roleColor = contributor.role === 'admin' ? chalk.red : 
                     contributor.role === 'editor' ? chalk.green : chalk.gray;
    console.log(`${index + 1}. ${contributor.name} ${roleColor(`[${contributor.role}]`)}`);
    console.log(chalk.gray(`   Email: ${contributor.email}`));
    console.log(chalk.gray(`   Joined: ${contributor.joinedAt.toISOString().split('T')[0]}`));
  });
}

async function handleWikiImpact(wikiManager: WikiManager, options: any, spinner: any): Promise<void> {
  if (!options.impactFile) {
    spinner.fail('Please provide --impact-file option');
    console.log(chalk.gray('\nUsage:'));
    console.log('  tsd-gen wiki impact --impact-file "src/example.ts" --impact-type "modified"');
    return;
  }

  spinner.text = 'Analyzing change impact...';

  const impact = await wikiManager.analyzeChangeImpact(
    options.impactFile,
    options.impactType
  );

  spinner.succeed('Impact analysis complete');

  console.log(chalk.blue('\n## Change Impact Analysis'));
  console.log(chalk.gray(`File: ${impact.filePath}`));
  console.log(chalk.gray(`Change Type: ${impact.changeType}`));
  console.log(chalk.gray(`Time: ${impact.timestamp.toLocaleString()}`));

  console.log(chalk.blue('\n## Direct Impacts'));
  if (impact.directImpacts.length === 0) {
    console.log(chalk.gray('  No direct impacts'));
  } else {
    impact.directImpacts.forEach((item: any) => {
      const levelColor = item.impactLevel === 'high' ? chalk.red : 
                        item.impactLevel === 'medium' ? chalk.yellow : chalk.green;
      console.log(`  - ${item.name} ${levelColor(`[${item.impactLevel}]`)}`);
      console.log(chalk.gray(`    Path: ${item.path}`));
      console.log(chalk.gray(`    Description: ${item.description}`));
    });
  }

  console.log(chalk.blue('\n## Indirect Impacts'));
  if (impact.indirectImpacts.length === 0) {
    console.log(chalk.gray('  No indirect impacts'));
  } else {
    impact.indirectImpacts.forEach((item: any) => {
      const levelColor = item.impactLevel === 'high' ? chalk.red : 
                        item.impactLevel === 'medium' ? chalk.yellow : chalk.green;
      console.log(`  - ${item.name} ${levelColor(`[${item.impactLevel}]`)}`);
      console.log(chalk.gray(`    Path: ${item.path}`));
    });
  }

  console.log(chalk.blue('\n## Risk Assessment'));
  const riskColor = impact.riskAssessment.overallRisk === 'critical' ? chalk.red :
                   impact.riskAssessment.overallRisk === 'high' ? chalk.yellow :
                   impact.riskAssessment.overallRisk === 'medium' ? chalk.blue : chalk.green;
  console.log(`  Overall Risk: ${riskColor(impact.riskAssessment.overallRisk)}`);
  console.log(`  Risk Score: ${impact.riskAssessment.riskScore}`);
  console.log(chalk.gray(`  Recommendation: ${impact.riskAssessment.recommendation}`));

  if (impact.suggestedActions.length > 0) {
    console.log(chalk.blue('\n## Suggested Actions'));
    impact.suggestedActions.slice(0, 5).forEach((action: any) => {
      const priorityColor = action.priority === 'urgent' ? chalk.red :
                           action.priority === 'high' ? chalk.yellow :
                           action.priority === 'medium' ? chalk.blue : chalk.gray;
      console.log(`  - ${action.description} ${priorityColor(`[${action.priority}]`)}`);
      console.log(chalk.gray(`    Type: ${action.type}`));
      console.log(chalk.gray(`    Target: ${action.target}`));
    });
    if (impact.suggestedActions.length > 5) {
      console.log(chalk.gray(`  ... and ${impact.suggestedActions.length - 5} more actions`));
    }
  }
}

program.parse();
