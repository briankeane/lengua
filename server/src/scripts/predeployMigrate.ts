import { execFileSync } from 'child_process';
import path from 'path';
import { ensureRequiredEnvVars } from './checkEnv';

/**
 * Single entrypoint for the Render preDeployCommand: validate env, then run
 * migrations. Render invokes preDeployCommand as one bare command with no shell,
 * so a `checkEnv && migrate` chain would silently skip the migrate — the chaining
 * has to live inside one process. A non-zero exit fails the deploy closed, so
 * Render never cuts traffic to an un-migrated schema.
 */
function main(): void {
  ensureRequiredEnvVars();

  console.log('Running database migrations...');

  // Compiled layout: this file is dist/scripts/predeployMigrate.js, so the app
  // root (where .sequelizerc and node_modules live) is two levels up. Resolve the
  // sequelize binary explicitly and anchor cwd there so .sequelizerc and its
  // CWD-relative `path.resolve('dist', ...)` config paths resolve regardless of the
  // process working directory. Call the binary directly rather than via npx.
  const appRoot = path.join(__dirname, '../..');
  const sequelizeBin = path.join(appRoot, 'node_modules', '.bin', 'sequelize');

  execFileSync(sequelizeBin, ['--options-path=.sequelizerc', 'db:migrate'], {
    stdio: 'inherit',
    cwd: appRoot,
  });
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error('Pre-deploy migration step failed:', error);
  process.exit(1);
}
