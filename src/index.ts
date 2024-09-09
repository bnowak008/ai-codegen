// src/cli.ts
import { Command } from 'commander';
import { promptUserForAppType } from './app';
import * as path from 'path';
import chalk from 'chalk';
import { initializeDatabase } from './database';

const program = new Command();
initializeDatabase().then(() => {
  program
    .version('1.0.0')
    .description(chalk.bold.yellow('AI-powered TypeScript project generator 🚀'))
    .action(async () => {
      console.log(chalk.blueBright('\nWelcome to the AI TypeScript Project Generator!\n'));
      const outputDir = path.resolve(process.cwd(), './generated');
      await promptUserForAppType(outputDir);
    });
  
  program.parse(process.argv);
});
