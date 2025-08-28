import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const main = async () => {
  try {
    // Run the TypeScript compiler
    console.log('Building project with tsc...');
    execSync('tsc', { stdio: 'inherit' });
    console.log('Build completed.');

    // Add shebang to the entry file
    const entryFilePath = path.join(process.cwd(), 'dist', 'index.js');
    console.log(`Adding shebang to ${entryFilePath}...`);

    let content = await fs.readFile(entryFilePath, 'utf-8');
    if (!content.startsWith('#!/usr/bin/env node')) {
      content = `#!/usr/bin/env node\n${content}`;
      await fs.writeFile(entryFilePath, content, 'utf-8');
      console.log('Shebang added successfully.');
    } else {
      console.log('Shebang already exists.');
    }

    // Ensure the file is executable
    await fs.chmod(entryFilePath, 0o755);
    console.log('Set executable permission on entry file.');

  } catch (error) {
    console.error('Build process failed:', error);
    process.exit(1);
  }
};

main();