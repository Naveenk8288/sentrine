import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const backupDir = path.join(rootDir, '.pages-api-backup');
const nextDir = path.join(rootDir, '.next');
const outDir = path.join(rootDir, 'out');

function moveDirSync(from, to) {
  if (fs.existsSync(to)) {
    fs.rmSync(to, { recursive: true, force: true });
  }
  fs.renameSync(from, to);
}

const hadApi = fs.existsSync(apiDir);
if (hadApi) {
  moveDirSync(apiDir, backupDir);
}

try {
  const demoCsv = path.join(rootDir, 'public', 'demo_feedback.csv');
  if (!fs.existsSync(demoCsv)) {
    execSync('npx tsx scripts/generate_dataset.ts', { stdio: 'inherit' });
  }
  fs.rmSync(nextDir, { recursive: true, force: true });
  execSync('npx next build', {
    stdio: 'inherit',
    env: { ...process.env, GITHUB_PAGES: 'true' },
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
} finally {
  if (hadApi && fs.existsSync(backupDir)) {
    moveDirSync(backupDir, apiDir);
  }
}
