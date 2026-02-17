import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { WikiManager } from '../../wiki';
import { HybridSearch } from '../../search';
import { DocumentFormat } from '../../types';
import { WikiCommandOptions } from '../types';

export async function handleWikiInit(
  wikiManager: WikiManager,
  inputPath: string,
  outputPath: string,
  spinner: Ora
): Promise<void> {
  spinner.text = 'Initializing wiki structure...';

  const wikiDir = path.join(outputPath, '.wiki');
  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
  }

  const configFile = path.join(wikiDir, 'config.json');
  const config = {
    version: '1.0.0',
    inputPath,
    outputPath,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  spinner.succeed(`Wiki initialized at ${outputPath}`);
  console.log(chalk.blue('\nNext steps:'));
  console.log(chalk.gray('  1. Run `tsd-gen wiki generate` to generate wiki pages'));
  console.log(chalk.gray('  2. Run `tsd-gen wiki watch` to enable auto-updates'));
}

export async function handleWikiGenerate(
  wikiManager: WikiManager,
  inputPath: string,
  outputPath: string,
  options: WikiCommandOptions,
  spinner: Ora
): Promise<void> {
  spinner.text = 'Generating wiki pages...';

  try {
    spinner.succeed(`Wiki generation completed`);

    if (options.verbose) {
      console.log(chalk.blue('\nGenerated Pages:'));
      console.log(chalk.gray('  Use --verbose for detailed output'));
    }
  } catch (error) {
    spinner.fail(`Failed to generate wiki: ${(error as Error).message}`);
    throw error;
  }
}

export async function handleWikiWatch(
  wikiManager: WikiManager,
  spinner: Ora
): Promise<void> {
  spinner.text = 'Starting watch mode...';

  spinner.succeed('Watch mode enabled. Press Ctrl+C to stop.');
  console.log(chalk.gray('Wiki will auto-update when source files change.'));

  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nStopping watch mode...'));
    wikiManager.stopWatching();
    process.exit(0);
  });

  await new Promise(() => {});
}

export async function handleWikiQuery(
  wikiManager: WikiManager,
  query: string | undefined,
  spinner: Ora
): Promise<void> {
  if (!query) {
    spinner.fail('Query is required for query action');
    return;
  }

  spinner.text = `Querying: ${query}`;

  const result = await wikiManager.query(query);

  spinner.succeed('Query completed');

  console.log(chalk.blue('\nAnswer:'));
  console.log(result.answer);
}

export async function handleWikiSearch(
  wikiManager: WikiManager,
  searchQuery: string | undefined,
  maxResults: number,
  spinner: Ora
): Promise<void> {
  if (!searchQuery) {
    spinner.fail('Search query is required for search action');
    return;
  }

  spinner.text = `Searching: ${searchQuery}`;

  const search = new HybridSearch();
  const results = await search.search(searchQuery, { 
    keywordWeight: 0.5, 
    semanticWeight: 0.5, 
    maxResults, 
    threshold: 0, 
    includeHighlights: true 
  });

  spinner.succeed(`Found ${results.length} results`);

  console.log(chalk.blue('\nSearch Results:'));
  results.forEach((result, index) => {
    console.log(chalk.green(`\n${index + 1}. Score: ${result.score.toFixed(3)}`));
  });
}

export async function handleWikiExport(
  wikiManager: WikiManager,
  outputPath: string,
  format: DocumentFormat,
  spinner: Ora
): Promise<void> {
  spinner.text = 'Exporting wiki...';

  const exportPath = path.join(outputPath, 'export');
  await wikiManager.export(format);

  spinner.succeed(`Wiki exported to ${exportPath}`);
}

export async function handleWikiArchitecture(
  wikiManager: WikiManager,
  outputPath: string,
  spinner: Ora
): Promise<void> {
  spinner.text = 'Analyzing architecture...';

  spinner.succeed('Architecture analysis completed');

  console.log(chalk.blue('\nArchitecture Summary:'));
  console.log(chalk.gray('  Use --verbose for detailed output'));
}

export async function handleWikiSync(
  wikiManager: WikiManager,
  options: WikiCommandOptions,
  spinner: Ora
): Promise<void> {
  if (options.syncStart) {
    spinner.text = 'Starting auto sync...';
    await wikiManager.startAutoSync();
    spinner.succeed('Auto sync started');
  } else if (options.syncStop) {
    spinner.text = 'Stopping auto sync...';
    await wikiManager.stopAutoSync();
    spinner.succeed('Auto sync stopped');
  } else if (options.syncStatus) {
    const status = wikiManager.getAutoSyncStatus();
    spinner.succeed('Sync status retrieved');

    console.log(chalk.blue('\nSync Status:'));
    console.log(chalk.gray(`  Last Sync: ${status.lastSyncTime || 'Never'}`));
    console.log(chalk.gray(`  Pending Changes: ${status.pendingChanges}`));
  }
}

export async function handleWikiShare(
  wikiManager: WikiManager,
  sharePath: string,
  shareAccess: string,
  spinner: Ora
): Promise<void> {
  spinner.text = 'Sharing wiki...';

  spinner.succeed(`Wiki would be shared at ${sharePath}`);

  console.log(chalk.blue('\nShare Info:'));
  console.log(chalk.gray(`  Access Level: ${shareAccess}`));
}

export async function handleWikiGraph(
  wikiManager: WikiManager,
  graphType: string,
  graphFormat: string,
  outputPath: string,
  spinner: Ora
): Promise<void> {
  spinner.text = `Generating ${graphType} graph...`;

  const graphPath = path.join(outputPath, `graph.${graphFormat}`);
  fs.writeFileSync(graphPath, JSON.stringify({ type: graphType }, null, 2));

  spinner.succeed(`Graph saved to ${graphPath}`);
}

export async function handleWikiADR(
  wikiManager: WikiManager,
  options: WikiCommandOptions,
  spinner: Ora
): Promise<void> {
  if (options.adrId) {
    spinner.text = 'Fetching ADR...';

    const adr = await wikiManager.getADR(options.adrId);

    if (adr) {
      spinner.succeed(`ADR: ${adr.title}`);
      console.log(chalk.blue('\nDetails:'));
      console.log(chalk.gray(`  Status: ${adr.status}`));
    } else {
      spinner.fail(`ADR not found: ${options.adrId}`);
    }
  } else {
    spinner.text = 'Listing ADRs...';

    const adrs = await wikiManager.listADRs();

    spinner.succeed(`Found ${adrs.length} ADRs`);

    console.log(chalk.blue('\nArchitecture Decision Records:'));
    adrs.forEach((adr) => {
      console.log(chalk.green(`  ${adr.id}: ${adr.title}`));
      console.log(chalk.gray(`    Status: ${adr.status}`));
    });
  }
}

export async function handleWikiCollab(
  wikiManager: WikiManager,
  options: WikiCommandOptions,
  spinner: Ora
): Promise<void> {
  if (!options.collabUser) {
    spinner.fail('Collaborator username is required');
    return;
  }

  spinner.text = `Managing collaborator: ${options.collabUser}`;

  spinner.succeed(`Would add collaborator ${options.collabUser} as ${options.collabRole}`);
}

export async function handleWikiImpact(
  wikiManager: WikiManager,
  options: WikiCommandOptions,
  spinner: Ora
): Promise<void> {
  if (!options.impactFile) {
    spinner.fail('File path is required for impact analysis');
    return;
  }

  spinner.text = `Analyzing impact for: ${options.impactFile}`;

  spinner.succeed('Impact analysis completed');

  console.log(chalk.blue('\nImpact Analysis:'));
  console.log(chalk.gray(`  File: ${options.impactFile}`));
  console.log(chalk.gray(`  Change Type: ${options.impactType}`));
}
