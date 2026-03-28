/**
 * Precompute Issue Portal issues from hansard ML pipeline data.
 *
 * Reads:  hansard_topic, hansard_inference, hansard_cpatf (P3-P6) / HansardDocument (P1-P2)
 * Writes: Topic  (upsert by pipeline_id + topic_cluster_id)
 *
 * Usage:
 *   node --max-old-space-size=1024 scripts/precomputeIssuePortal.js --pipeline pipeline5 --force
 *   node --max-old-space-size=2048 scripts/precomputeIssuePortal.js --pipeline pipeline1 --force
 *   node --max-old-space-size=2048 scripts/precomputeIssuePortal.js --pipeline pipeline2 --force
 *
 * pipeline1/pipeline2 use hansard_segmented (many turns per doc); use 2048 MB heap to avoid OOM.
 * pipeline3–pipeline6 use hansard_cpatf; 1024 MB is usually enough.
 * Text fields are truncated to 3000 chars at the DB level via aggregation $substrCP,
 * so raw ocr_text (potentially hundreds of MB per document) is never loaded into Node.js.
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

  const force = args.includes('--force');
  const pipelines = pipelineFlag ? [pipelineFlag] : ALL_PIPELINES;

  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI not set in environment.');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Issue Portal Precompute');
  console.log('='.repeat(60));
  console.log(`Pipelines : ${pipelines.join(', ')}`);
  console.log(`Force     : ${force}`);
  console.log(`Target    : Topic`);
  console.log('='.repeat(60));

  const service = new IssuePortalService(process.env.MONGO_URI);

  try {
    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const pipelineId of pipelines) {
      const result = await service.precompute(pipelineId, force);
      totalProcessed += result.processed || 0;
      totalSkipped  += result.skipped  || 0;
      if (result.error) {
        console.warn(`  WARNING [${pipelineId}]: ${result.error}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`DONE  processed=${totalProcessed}  skipped=${totalSkipped}`);
    console.log('='.repeat(60));
  } finally {
    await service.disconnect();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
