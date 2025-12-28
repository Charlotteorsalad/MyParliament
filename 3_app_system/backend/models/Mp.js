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
      responseRate: { type: Number, default: null },
      escalateRate: { type: Number, default: null }
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
