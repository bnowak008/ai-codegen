import { Command } from 'commander';
import chalk from 'chalk';

import { promptUser } from './app';

const program = new Command();

program
  .version('1.0.0')
  .description(chalk.bold.yellow('Simple cli'))
  .action(async () => {
    console.log(chalk.blueBright('\nWelcome to the cli!\n'));

    await promptUser();
  });

program.parse(process.argv);