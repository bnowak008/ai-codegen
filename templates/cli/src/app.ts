import * as readline from 'readline';
import chalk from 'chalk';

export async function promptUser(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(
    chalk.cyan('Hello?'),
    async (answer) => {
      console.log(chalk.green(`\n${chalk.bold('world')}\n`));
      
      rl.close();
    }
  );
}
