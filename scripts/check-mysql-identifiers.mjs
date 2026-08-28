import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MYSQL_IDENTIFIER_LIMIT = 64;
const migrationsDirectory = new URL('../src/db/migrations/', import.meta.url);
const identifierPattern = /(?:CONSTRAINT|INDEX|KEY)\s+`([^`]+)`/gi;

const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const sqlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'));
const violations = [];

for (const file of sqlFiles) {
  const sql = await readFile(join(migrationsDirectory.pathname, file.name), 'utf8');

  for (const match of sql.matchAll(identifierPattern)) {
    const identifier = match[1];

    if (identifier.length > MYSQL_IDENTIFIER_LIMIT) {
      violations.push({ file: file.name, identifier, length: identifier.length });
    }
  }
}

if (violations.length > 0) {
  console.error(`MySQL identifiers must not exceed ${MYSQL_IDENTIFIER_LIMIT} characters:`);
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.identifier} (${violation.length})`);
  }
  process.exitCode = 1;
} else {
  console.log(`MySQL migration identifiers are within the ${MYSQL_IDENTIFIER_LIMIT}-character limit.`);
}
