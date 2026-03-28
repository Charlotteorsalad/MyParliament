/**
 * Re-run title generation for one or all pipelines WITHOUT re-precomputing the full dataset.
 *
 * Usage:
 *   node scripts/refreshTitles.js --pipeline pipeline5
 *   node scripts/refreshTitles.js           (all pipelines)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const IssuePortalService = require('../services/issuePortalService');

const ALL_PIPELINES = ['pipeline1','pipeline2','pipeline3','pipeline4','pipeline5','pipeline6'];

async function main() {
  const args = process.argv.slice(2);
  const pipelineFlag =
    args.find(a => a.startsWith('--pipeline='))?.split('=')[1] ||
    (args.includes('--pipeline') ? args[args.indexOf('--pipeline') + 1] : null);

  const pipelines = pipelineFlag ? [pipelineFlag] : ALL_PIPELINES;

  if (!process.env.MONGO_URI) { console.error('MONGO_URI not set'); process.exit(1); }

  const service = new IssuePortalService(process.env.MONGO_URI);
  try {
    for (const pid of pipelines) {
      console.log(`\nRefreshing titles for ${pid} ...`);
      const r = await service.refreshTitles(pid);
      console.log(`  updated=${r.updated}  total=${r.total}`);
    }
  } finally {
    await service.disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
