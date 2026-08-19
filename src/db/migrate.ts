import * as fs from 'fs';
import * as path from 'path';

const dbDir = path.join(process.cwd(), 'src', 'db');
const drizzleMigrationsDir = path.join(dbDir, 'migrations');
const outputFile = path.join(dbDir, 'manual-migration.sql');

const readAllFiles = (dirPath: string): string[] => {
  const out: string[] = [];
  if (!fs.existsSync(dirPath)) return out;

  const walk = (p: string): void => {
    const items = fs.readdirSync(p);

    for (const item of items) {
      const full = path.join(p, item);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) walk(full);
      else out.push(full);
    }
  };

  walk(dirPath);
  return out;
};

const getLineCol = (text: string, pos: number): { line: number; col: number } => {
  let line = 1;
  let col = 1;

  for (let i = 0; i < text.length && i < pos; i += 1) {
    if (text[i] === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }

  return { line, col };
};

const showContext = (text: string, pos: number): string => {
  const start = Math.max(0, pos - 80);
  const end = Math.min(text.length, pos + 80);
  return text.slice(start, end).replace(/\r/g, '\\r').replace(/\n/g, '\\n\n');
};

const validateJsonFiles = (jsonFiles: string[]): void => {
  let badCount = 0;

  for (const file of jsonFiles) {
    const raw = fs.readFileSync(file, 'utf8');

    try {
      JSON.parse(raw);
    } catch (e: unknown) {
      badCount += 1;
      const msg = e instanceof Error ? e.message : String(e);
      const positionMatch = msg.match(/position\s+(\d+)/i);
      const pos = positionMatch?.[1] ? Number(positionMatch[1]) : null;

      console.log('\n=== MALFORMED JSON ===');
      console.log(file);
      console.log(msg);

      if (pos !== null && Number.isFinite(pos)) {
        const lc = getLineCol(raw, pos);
        console.log(`Approx location: line ${lc.line}, col ${lc.col}, pos ${pos}`);
        console.log('Context around error:');
        console.log(showContext(raw, pos));
      } else {
        console.log('Could not extract position from error message.');
      }
    }
  }

  if (badCount) {
    console.log(`\nFound ${badCount} malformed JSON file(s). Fix them and re-run drizzle-kit.`);
    process.exit(1);
  }
};

const main = (): void => {
  const targets = [drizzleMigrationsDir];
  const seen = new Set<string>();
  const jsonFiles: string[] = [];
  const sqlFiles: string[] = [];

  for (const target of targets) {
    const files = readAllFiles(target);

    for (const file of files) {
      const lower = file.toLowerCase();
      if (seen.has(file)) continue;
      seen.add(file);

      if (lower.endsWith('.json')) jsonFiles.push(file);
      if (lower.endsWith('.sql') && file !== outputFile) sqlFiles.push(file);
    }
  }

  validateJsonFiles(jsonFiles);

  if (!sqlFiles.length) {
    console.log('No SQL migration files found. Run npm run db:generate first.');
    process.exit(0);
  }

  const output = sqlFiles
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(file, 'utf8').trim();
      const relativePath = path.relative(process.cwd(), file);
      return `-- ${relativePath}\n${sql}\n`;
    })
    .join('\n');

  fs.mkdirSync(dbDir, { recursive: true });
  fs.writeFileSync(outputFile, `${output}\n`, 'utf8');

  console.log(`Manual SQL migration file created: ${path.relative(process.cwd(), outputFile)}`);
  console.log('Copy and paste that SQL into MySQL Workbench when you are ready to apply it.');
};

main();
