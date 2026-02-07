const { MongoClient, ObjectId } = require('mongodb');

/**
 * Issue Portal Service - Get MP statements for a specific topic
 */

class IssuePortalService {
  constructor(mongoUri) {
    this.mongoUri = mongoUri;
    this.client = null;
  }

  async connect() {
    if (!this.client) {
      this.client = new MongoClient(this.mongoUri);
      await this.client.connect();
    }
    return this.client.db('MyParliament');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Find cluster_id for a given topic name (fuzzy search)
   */
  async getTopicClusterId(pipelineId, topicName) {
    const db = await this.connect();
    const topic = await db.collection('hansard_topic').findOne({
      pipeline_id: pipelineId,
      $or: [
        { 'topic_label.name_en': { $regex: topicName, $options: 'i' } },
        { 'topic_label.name_ms': { $regex: topicName, $options: 'i' } },
      ]
    });

    return topic ? topic.cluster_id : null;
  }

  /**
   * Get topic info by cluster_id
   */
  async getTopicInfo(pipelineId, clusterId) {
    const db = await this.connect();
    const topic = await db.collection('hansard_topic').findOne({
      pipeline_id: pipelineId,
      cluster_id: parseInt(clusterId),
    });

    if (topic) {
      return {
        cluster_id: topic.cluster_id,
        name_en: topic.topic_label.name_en,
        name_ms: topic.topic_label.name_ms,
        description: topic.topic_label.description || '',
        keywords: topic.keywords || [],
        quality: topic.metadata?.label_quality || 'unknown',
      };
    }

    return {
      cluster_id: parseInt(clusterId),
      name_en: `Topic ${clusterId}`,
      name_ms: `Topik ${clusterId}`,
      description: '',
      keywords: [],
      quality: 'unknown',
    };
  }

  /**
   * Get all MP statements for a given topic
   */
  async getStatementsForTopic(pipelineId, clusterId, options = {}) {
    const {
      limit = 100,
      dateFrom = null,
      dateTo = null,
      mpName = null,
      party = null,
    } = options;

    const db = await this.connect();

    // 1. Get inference: docIds where cluster == clusterId
    const inference = await db.collection('hansard_inference').findOne({
      pipelineId: pipelineId,
    });

    if (!inference) {
      return [];
    }

    const docIds = inference.docIds || [];
    const clusters = inference.clusters || [];

    // Filter docIds where cluster == clusterId
    const topicDocIds = docIds
      .map((docId, i) => (clusters[i] === parseInt(clusterId) ? docId : null))
      .filter(id => id !== null)
      .slice(0, limit); // Limit at query level for performance

    if (topicDocIds.length === 0) {
      return [];
    }

    // 2. Determine collection and text field
    const collectionName = ['pipeline1', 'pipeline2'].includes(pipelineId)
      ? 'HansardDocument'
      : 'hansard_cpatf';
    const textField = ['pipeline1', 'pipeline2'].includes(pipelineId)
      ? 'ocr_text'
      : 'cleaned_text';

    // 3. Convert to ObjectId
    const objIds = topicDocIds.map(id => {
      try {
        return new ObjectId(id);
      } catch (e) {
        return id;
      }
    });

    // 4. Build query with optional filters
    const query = { _id: { $in: objIds } };

    if (dateFrom || dateTo) {
      query.hansardDate = {};
      if (dateFrom) query.hansardDate.$gte = new Date(dateFrom);
      if (dateTo) query.hansardDate.$lte = new Date(dateTo);
    }

    if (mpName) {
      query.speaker = { $regex: mpName, $options: 'i' };
    }

    if (party) {
      query.party = { $regex: party, $options: 'i' };
    }

    // 5. Fetch documents
    const collection = db.collection(collectionName);
    const documents = await collection.find(query).limit(limit).toArray();

    // 6. Format statements
    const statements = documents.map(doc => {
      const text = doc[textField] || doc.ocr_text || doc.cleaned_text || '';
      
      return {
        doc_id: doc._id.toString(),
        mp_name: doc.speaker || 'Unknown',
        party: doc.party || 'Unknown',
        date: doc.hansardDate ? doc.hansardDate.toISOString() : null,
        parlimen: doc.parlimen,
        penggal: doc.penggal,
        mesyuarat: doc.mesyuarat,
        parlimen_range: doc.parlimen_range,
        session_label: this.formatSession(doc),
        text_excerpt: text.substring(0, 500),
        text_full: text,
        text_length: text.length,
      };
    });

    // Sort by date (most recent first)
    statements.sort((a, b) => {
      const dateA = a.date || '1900-01-01';
      const dateB = b.date || '1900-01-01';
      return dateB.localeCompare(dateA);
    });

    return statements;
  }

  /**
   * Format session label for display
   */
  formatSession(doc) {
    const { parlimen, penggal, mesyuarat, parlimen_range } = doc;

    if (parlimen_range) {
      return `Parlimen ${parlimen_range}`;
    } else if (parlimen && penggal && mesyuarat) {
      return `P${parlimen} Penggal ${penggal} Mesyuarat ${mesyuarat}`;
    } else if (parlimen) {
      return `Parlimen ${parlimen}`;
    }
    return 'Unknown Session';
  }

  /**
   * Get issue detail (topic info + statements)
   */
  async getIssueDetail(pipelineId, topicIdentifier, options = {}) {
    try {
      // topicIdentifier can be topic name or cluster_id
      let clusterId;

      if (isNaN(topicIdentifier)) {
        // It's a topic name, search for cluster_id
        clusterId = await this.getTopicClusterId(pipelineId, topicIdentifier);
        if (!clusterId && clusterId !== 0) {
          return { error: 'Topic not found', status: 404 };
        }
      } else {
        // It's already a cluster_id
        clusterId = parseInt(topicIdentifier);
      }

      const topicInfo = await this.getTopicInfo(pipelineId, clusterId);
      const statements = await this.getStatementsForTopic(
        pipelineId,
        clusterId,
        options
      );

      return {
        topic: topicInfo,
        statement_count: statements.length,
        statements: statements,
      };
    } catch (error) {
      console.error('Error in getIssueDetail:', error);
      throw error;
    }
  }
}

module.exports = IssuePortalService;
