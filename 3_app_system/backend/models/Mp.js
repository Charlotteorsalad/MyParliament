const mongoose = require('mongoose');
const { Schema } = mongoose;

const MpSchema = new Schema(
  {
    mp_id: String,
    name: String,
    full_name_with_titles: String,
    honorifics: [String],
    party: String,
    party_full_name: String,
    constituency: String,
    constituency_code: String,
    constituency_name: String,
    positionInParliament: String,
    parliament_term: String,
    status: String,
    service: String,
    created_at: { type: String }, 

    performance: {
      attendanceRate: { type: Number, default: null },
      /** reply / total turns × 100 — from precomputeMpIssueSpeakingStats.js */
      responseRate: { type: Number, default: null },
      /** ask / total turns × 100 — from precomputeMpIssueSpeakingStats.js */
      askRate: { type: Number, default: null },
      /** escalate / total turns × 100 — from precomputeMpIssueSpeakingStats.js */
      escalateRate: { type: Number, default: null },
      /** interjection / total turns × 100 — from precomputeMpIssueSpeakingStats.js */
      interjectionRate: { type: Number, default: null },
      /** Average sentiment score 0–100 (50=neutral) — from precomputeMpIssueSpeakingStats.js */
      sentimentScore: { type: Number, default: null },
      /** Pre-computed attendance by parliament term (from precomputeMpAttendance.js) */
      attendanceByTerm: { type: [Schema.Types.Mixed], default: undefined },
      /** When attendance was last pre-computed (ISO date) */
      attendanceComputedAt: { type: Date, default: null },
      /** Top 8 recent statements — from precomputeMpIssueSpeakingStats.js */
      recentStatements: { type: [Schema.Types.Mixed], default: undefined },
      /** When speaking stats were last pre-computed and which pipeline was used */
      speakingStatsComputedAt: { type: Date, default: null },
      speakingStatsPipeline: { type: String, default: null },
    },

    topicDiscussed: { type: [Schema.Types.Mixed], default: [] },

    sentimentAnalysis: {
      content: { type: String, default: null },
      score: { type: Number, default: null },
      date: { type: String, default: null }
    },

    mentionedInHansard: { type: [Schema.Types.Mixed], default: [] },

    profilePicture: String,
    profile_url: String,
    state: String,
    positionInCabinet: String,
    seatNumber: String,
    phone: String,
    fax: String,
    email: String,
    address: String,

    honorific_analysis: Schema.Types.Mixed,
    all_discovered_honorifics: [String],
    categorized_honorifics: Schema.Types.Mixed,

    original_name_variations: [String],
    extraction_method: String,

    match_details: Schema.Types.Mixed,

    historical_identity: Schema.Types.Mixed,
    current_identity: Schema.Types.Mixed,

    parliamentary_history: [Schema.Types.Mixed]
  },
  { versionKey: false, collection: 'MP' }
);

// Common indexes
MpSchema.index({ status: 1, parliament_term: 1 });
MpSchema.index({ party: 1, state: 1 });
MpSchema.index({ name: 'text', constituency: 'text' });

module.exports = mongoose.model('MP', MpSchema);
