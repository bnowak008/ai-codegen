import OpenAi from 'openai';
import * as readline from 'readline';
import * as fileManager from './fileManager';
import chalk from 'chalk';
import { saveStep } from './database';
import dotenv from 'dotenv';
import { spawn, exec } from 'child_process';

dotenv.config();

const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function promptUserForAppType(directory: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(
    chalk.cyan('What kind of app would you like to generate? ') + chalk.yellow.bold('(e.g., a to-do list app)\n'),
    async (answer) => {
      console.log(chalk.green(`\nYou requested: ${chalk.bold(answer)}\n`));
  
      // Step 1: Generate step-by-step instructions along with the folder structure
      const { instructions, folderStructure } = await generateInstructions(answer);
      console.log(chalk.blueBright('\nGenerated Instructions:\n'));
      instructions.forEach((step: string, index: number) => {
        console.log(chalk.greenBright(`Step ${index + 1}: ${step}`));
      });
  
      // Step 3: Execute each step one by one to populate files
      for (let i = 0; i < instructions.length; i++) {
        await processStep(answer, instructions[i], i);
      }
  
      // Step 4: Run install, build, and test commands in Docker, recursively attempt fixes if errors occur
      console.log(chalk.cyanBright('\nRunning install, build, and test commands in Docker...\n'));
  
      // Recursively handle installation, build, and test with error fixes
      await fixAndRerunCommand(answer, 'npm install', 'installation', directory);
      await fixAndRerunCommand(answer, 'npm run build', 'build', directory);
      await fixAndRerunCommand(answer, 'npm test', 'testing', directory);
  
      console.log(chalk.greenBright.bold(`\nApp successfully generated and saved in ${directory}`));
      rl.close();
    }
  );
}

// Utility function to run a command in Docker and stream logs in real-time
function runCommandInDocker(command: string, directory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Spawn the docker container process
    const dockerProcess = spawn('docker', [
      'run', '--rm',
      '-v', `${directory}:/app`, // Mount the directory
      '-w', '/app', // Set the working directory in the container
      'node:14',    // Use the node image
      'bash', '-c', command // Run the command in bash inside the container
    ]);

    // Stream the stdout (logs) as the process runs
    dockerProcess.stdout.on('data', (data) => {
      process.stdout.write(data.toString()); // Write stdout stream to the terminal
    });

    // Stream the stderr (errors) as the process runs
    dockerProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString()); // Write stderr stream to the terminal
    });

    // Handle process exit
    dockerProcess.on('close', (code) => {
      if (code === 0) {
        resolve(); // Command executed successfully
      } else {
        reject(new Error(`Process exited with code ${code}`)); // There was an error
      }
    });
  });
}

// Utility function to call ChatGPT with error information
async function requestFixFromChatGPT(answer: string, error: string) {
  return await generateInstructions(`Fix this error: ${error}. For the app: ${answer}`);
}

// Process and apply each step of instructions
async function processStep(answer: string, step: string, stepIndex: number) {
  console.log(chalk.cyan(`\nProcessing Step ${stepIndex + 1}: ${step}\n`));

  const fileCreation = parseFileCreations(step)[0];

  if (fileCreation) {
    await saveStep(answer, step, '');

    // Save the generated code for each step
    await fileManager.createFile(fileCreation.filePath, fileCreation.fileContent);
    console.log(chalk.greenBright(`\nFile created: ${fileCreation.filePath}\n`));
  } else {
    console.log(chalk.redBright(`\nCould not find a file path for step ${stepIndex + 1}: ${step}\n`));
  }

  const commands = parseCommands(step);
  for (const command of commands) {
    console.log(chalk.cyan(`Running command: ${command}\n`));
    await executeCommand(command);
  }
}

// Recursive function to fix errors and rerun commands
async function fixAndRerunCommand(answer: string, command: string, stage: string, directory: string) {
  try {
    // Try running the command again
    await runCommandInDocker(command, directory);
    console.log(chalk.greenBright(`\n${stage} completed successfully!\n`));
  } catch (error: any) {
    // If there's an error, try to fix it
    console.log(chalk.redBright(`\nError occurred during ${stage}: ${error.stderr}\n`));
    console.log(chalk.cyanBright(`\nRequesting a fix from ChatGPT for ${stage}...\n`));

    const { instructions: fixInstructions } = await generateInstructions(answer, error.stderr);
    console.log(chalk.blueBright(`\nFix instructions received for ${stage}:\n`));
    fixInstructions.forEach((fixStep: string, index: number) => {
      console.log(chalk.greenBright(`Fix Step ${index + 1}: ${fixStep}`));
    });

    // Apply the fix instructions
    for (let i = 0; i < fixInstructions.length; i++) {
      await processStep(answer, fixInstructions[i], i);
    }

    // After applying the fix, recursively try running the command again
    await fixAndRerunCommand(answer, command, stage, directory);
  }
}

// Generate step-by-step instructions and folder structure for building the app
async function generateInstructions(prompt: string, type: 'default' | 'error' = 'default'): Promise<{ instructions: string[], folderStructure: string[] }> {
  // if (type === 'default') 
  //     return {
  //       instructions: [
  //           " Project Structure and Description\n\nThe project is a simple Node.js app that uses the OpenWeatherMap API to fetch the weather for Milwaukee, Wisconsin, and displays it. The app uses Express.js as a web framework to handle HTTP requests and responses. Axios is used to make HTTP requests to the weather API. The application is written in TypeScript, a typed superset of JavaScript that adds static types and other features to the language.\n\n```\n*****PROJECT STRUCTURE START*****\ngenerated\n|__src\n  |__index.ts\n|__package.json\n|__.env\n|__test\n  |__index.test.ts\n|__README.md\n|__tsconfig.json\n*****PROJECT STRUCTURE END*****\n```\n\n",
  //           " Setting Up the Environment\n\nFirst, we need to create a new directory and initialize our project. Then we install our dependencies.\n\n*****COMMAND START*****\nmkdir generated && cd generated && npm init -y && npm install express axios dotenv && npm install -D typescript @types/node @types/express ts-node\n*****COMMAND END*****\n\n",
  //           " Create tsconfig.json\n\nCreate a tsconfig.json file to configure the TypeScript compiler.\n\n*****FILE CREATION START*****\n// tsconfig.json\n{\n  \"compilerOptions\": {\n    \"target\": \"ES6\",\n    \"module\": \"commonjs\",\n    \"rootDir\": \"src\",\n    \"outDir\": \"dist\",\n    \"strict\": true,\n    \"esModuleInterop\": true\n  }\n}\n*****FILE CREATION END*****\n\n",
  //           " Create the .env file\n\nWe will store our API key and the base URL for the weather API in the .env file. Note that the actual API key is not provided here for security reasons. You need to sign up on the OpenWeatherMap website to get your API key.\n\n*****FILE CREATION START*****\n// .env\nOPEN_WEATHER_MAP_API_KEY=\"your_api_key_here\"\nOPEN_WEATHER_MAP_API_URL=\"http://api.openweathermap.org/data/2.5/weather\"\nCITY_NAME=\"Milwaukee\"\nSTATE_CODE=\"WI\"\nCOUNTRY_CODE=\"US\"\n*****FILE CREATION END*****\n\n",
  //           " Create the index.ts file\n\nThis is the main file of our application. It sets up an Express server and defines a GET route '/' that fetches the weather data and sends it as a response.\n\n*****FILE CREATION START*****\n// src/index.ts\nimport express from 'express';\nimport axios from 'axios';\nimport dotenv from 'dotenv';\n\ndotenv.config();\n\nconst app = express();\nconst port = 3000;\n\napp.get('/', async (req, res) => {\n  try {\n    const response = await axios.get(`${process.env.OPEN_WEATHER_MAP_API_URL}?q=${process.env.CITY_NAME},${process.env.STATE_CODE},${process.env.COUNTRY_CODE}&appid=${process.env.OPEN_WEATHER_MAP_API_KEY}`);\n    res.send(response.data);\n  } catch (error) {\n    console.error(error);\n    res.status(500).send('An error occurred while fetching the weather data.');\n  }\n});\n\napp.listen(port, () => {\n  console.log(`Server is running at http://localhost:${port}`);\n});\n*****FILE CREATION END*****\n\n",
  //           " Create the package.json file\n\nUpdate the package.json file to include the start script.\n\n*****FILE CREATION START*****\n// package.json\n{\n  \"name\": \"weather-app\",\n  \"version\": \"1.0.0\",\n  \"description\": \"A Node.js app that displays the weather for Milwaukee, WI.\",\n  \"main\": \"src/index.ts\",\n  \"scripts\": {\n    \"start\": \"ts-node src/index.ts\"\n  },\n  \"dependencies\": {\n    \"axios\": \"^0.21.1\",\n    \"dotenv\": \"^8.2.0\",\n    \"express\": \"^4.17.1\"\n  },\n  \"devDependencies\": {\n    \"@types/express\": \"^4.17.9\",\n    \"@types/node\": \"^14.14.31\",\n    \"ts-node\": \"^9.1.1\",\n    \"typescript\": \"^4.2.3\"\n  }\n}\n*****FILE CREATION END*****",
  //         ],
  //     folderStructure: []
  //   };

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {"role": "system", "content": `
        You are a coding assistant specialized in TypeScript, Node.js, React, and React Native.
        You are helping a user generate a project by providing clear, structured steps abiding strictly by the following requirements.

        The requirements are as follows:

        1. Provide a step-by-step guide to build the app in a production-ready manner using TypeScript.
          - Place the project in a directory called 'generated'.
          - Each step MUST be labeled with: '{**Step <number_here>**}' for easy parsing. Keep this exact format. For example '**Step 1**', 'Step 1', or any other variation would be incorrect, while '{**Step 1**}' is correct.

        2. In {**Step 1**}, include the full folder and file structure of the project. and a detailed description of the project and how it works.
          - Label the project structure section as:
            \`\`\`
            *****PROJECT STRUCTURE START*****
            <project structure>
            *****PROJECT STRUCTURE END*****
            \`\`\`

        3. For **each file you create**, use the following format:
          - Label the creation of each file and it's content with:
            \`\`\`
            *****FILE CREATION START*****
            // <file_path>
            <file content here>
            *****FILE CREATION END*****
            \`\`\`
          - This should be the only way files are created/modified. If a file needs to be modified, recreate the entire file content with the changes and use the same format outlined above.
          - Always begin with creating the package.json and tsconfig.json files along with the necessary files before attempting to generate any commands.

        4. **Step 2** should include setting up the environment, such as installing dependencies or configuring the database.
          - Bash commands must be labeled as:
            \`\`\`
            *****COMMAND START*****
            <bash command>
            *****COMMAND END*****
            \`\`\`
          - Split the commands into individual steps or chain them using '&&'.
          - Assume the commands are being run in the root of the 'generated' directory.
          - Do not use bash commands to create directories or files; all file and directory creation must use the 'FILE CREATION' format specified above.
          - Only include commands for environment setup, such as installing dependencies or configuring the database.

        6. Ensure all output is easily parseable by following the labeled formats for:
          - File creation
          - File content
          - Commands
          - Tests

        ${type === 'error' ? ERROR_PROMPT : CREATION_PROMPT}
      `},
      {"role": "user", "content": "" + prompt + "."}
    ],
    temperature: 0.7,
    max_tokens: 1500
  });

  const responseText = response.choices[0].message.content?.trim() || '';
  
  const instructions = responseText.split(/{\*\*Step \d\*\*}/).filter((step, index) => index !== 0 && step.length > 0);

  // Extract folder structure and instructions
  // const folderStructure = extractFolderStructure(instructions[0]);

  return { instructions, folderStructure: [] };
}


// Execute given comman in the terminal
async function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Generalized function to extract content between any start and end markers
export function parseByMarkers(content: string, marker: string): string[] {
  const startMarker = `*****${marker} START*****`;
  const endMarker = `*****${marker} END*****`;
  return extractBetweenMarkers(content, startMarker, endMarker);
}

function extractBetweenMarkers(content: string, startMarker: string, endMarker: string): string[] {
  const regex = new RegExp(`${startMarker.replace(/\*/g, '\\*')}([\\s\\S]*?)${endMarker.replace(/\*/g, '\\*')}`, 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

// Specific functions to parse different types of content

// 1. Parse Project Structure
export function parseProjectStructure(content: string): string[] {
  return parseByMarkers(content, 'PROJECT STRUCTURE');
}
export function parseFileCreations(content: string): { filePath: string; fileContent: string }[] {
  const fileCreations = parseByMarkers(content, 'FILE CREATION');
  return fileCreations.map(fileCreation => {
    const filePathMatch = fileCreation.match(/\/\/ (.+)/);
    const filePath = filePathMatch ? filePathMatch[1].trim() : '';
    
    // Strip the code block markers (```tsx, ```js, etc.) if they exist
    let fileContent = fileCreation.replace(/\/\/ .+/, '').trim();
    fileContent = fileContent.replace(/```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    
    return { filePath, fileContent };
  });
}

// 3. Parse Commands
export function parseCommands(content: string): string[] {
  return parseByMarkers(content, 'COMMAND');
}

// 4. Parse Tests
export function parseTests(content: string): string[] {
  return parseByMarkers(content, 'TEST');
}

const CREATION_PROMPT = `
  The resulting output should be step-by-step details in the correct order, with clear file paths and content. It must be a full project that includes a README file that explains; the project, it's dependencies and why they are used, and the start, dev, build, and test scripts and how to run the project.
  All backend code should use the following packges; tsx for building and hot reloading, Vitest for testing, Fastify for all Rest endpoints. Generate a swagger.json file if there are any api enpoints. If it includes a frontend it should use react, orval, vite, vitest, playwright, and mui.
`;

const ERROR_PROMPT = `
  The user has encountered an error in the project generation process and needs help fixing it.
  Your task is to provide a step-by-step guide to fix the error and continue with the project generation.
  Ensure that the fix instructions are clear, concise, and easy to follow.
`;
