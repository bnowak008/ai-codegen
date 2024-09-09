// src/fileManager.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

const DIRECTORY = path.resolve(__dirname, '../generated');

// Create and write a file
export async function createFile(filePath: string, content: string): Promise<void> {
    const directoryPath = path.dirname(filePath);
    const fullDirectoryPath = path.resolve(DIRECTORY, directoryPath);
    await fs.ensureDir(fullDirectoryPath);

    const fullPath = path.resolve(DIRECTORY, filePath);
    await fs.writeFile(fullPath, content, 'utf-8');

    console.log(chalk.green(`File created at: ${chalk.underline(fullPath)}\n`));
}
