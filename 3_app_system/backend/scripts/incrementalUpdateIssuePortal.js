/**
 * Incremental update for Issue Portal topics.
 * 
 * Adds new documents from recent mesyuarat to existing topics.
 * Follows Penggal/Mesyuarat structure to process only new sessions.
 * 
 * Usage:
 *   node --max-old-space-size=1024 scripts/incrementalUpdateIssuePortal.js
 *   node --max-old-space-size=1024 scripts/incrementalUpdateIssuePortal.js --pipeline pipeline5
 *   node --max-old-space-size=1024 scripts/incrementalUpdateIssuePortal.js --pipeline pipeline5 --since YYYY-MM-DD
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const IssuePortalService = require('../services/issuePortalService');

const ALL_PIPELINES = [
  'pipeline1',
  'pipeline2',
  'pipeline3',
  'pipeline4',
  'pipeline5',
  'pipeline6',
];

async function main() {
  const args = process.argv.slice(2);

  // --pipeline pipeline5  or  --pipeline=pipeline5
  const pipelineFlag =
    args.find(a => a.startsWith('--pipeline='))?.split('=')[1] ||
    (args.includes('--pipeline')
      ? args[args.indexOf('--pipeline') + 1]
      : null);

  // --since YYYY-MM-DD  or  --since=YYYY-MM-DD
  const sinceFlag =
    args.find(a => a.startsWith('--since='))?.split('=')[1] ||
    (args.includes('--since')
      ? args[args.indexOf('--since') + 1]
      : null);

  const pipelines = pipelineFlag ? [pipelineFlag] : ALL_PIPELINES;
  const sinceDate = sinceFlag ? new Date(sinceFlag) : null;

  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI not set in environment.');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Issue Portal Incremental Update');
  console.log('='.repeat(60));
  console.log(`Pipelines : ${pipelines.join(', ')}`);
  console.log(`Since Date : ${sinceDate ? sinceDate.toISOString().split('T')[0] : 'auto (latest computed date)'}`);
  console.log(`Target    : Topic`);
  console.log('='.repeat(60));

  const service = new IssuePortalService(process.env.MONGO_URI);

  try {
    let totalUpdated = 0;
    let totalMesyuarat = 0;

    for (const pipelineId of pipelines) {
      const result = await service.incrementalUpdate(pipelineId, sinceDate);
      totalUpdated += result.updated || 0;
      totalMesyuarat += result.newMesyuarat || 0;
      if (result.error) {
        console.warn(`  WARNING [${pipelineId}]: ${result.error}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`DONE  updated=${totalUpdated} topics  mesyuarat=${totalMesyuarat}`);
    console.log('='.repeat(60));
  } finally {
    await service.disconnect();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
