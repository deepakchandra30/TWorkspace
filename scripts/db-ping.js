// Checks the Atlas connection: `npm run db:ping`
import { connectDb, closeDb, COLLECTIONS } from '../server/db.js';

try {
  const db = await connectDb();
  const started = Date.now();
  await db.command({ ping: 1 });
  console.log(`Connected to "${db.databaseName}" (ping ${Date.now() - started} ms)`);

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of COLLECTIONS) {
    console.log(`  ${existing.has(name) ? '✓' : '·'} ${name}`);
  }
} catch (err) {
  console.error('Connection failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
