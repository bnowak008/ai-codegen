import { exec } from 'child_process';

export async function runTests(directory: string): Promise<{ errors?: string; success?: string }> {
  return new Promise((resolve) => {
    exec('npx jest', { cwd: directory }, (error, stdout, stderr) => {
      if (error) {
        resolve({ errors: stderr });
      } else {
        resolve({ success: stdout });
      }
    });
  });
}
