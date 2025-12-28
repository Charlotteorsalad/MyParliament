const express = require('express');
const router = express.Router();
const mpController = require('../controllers/mpController');
const mpService = require('../services/mpService');
const Mp = require('../models/Mp');

// MP routes
router.get('/featured', mpController.getFeatured);
router.get('/stats', mpController.getStats);
router.get('/list', mpController.getList);
router.get('/detail/:id', mpController.getDetail);
router.get('/:id', mpController.getDetail); // Allow direct MP ID access (must be last)
router.get('/', mpController.getList); // Add root route for query parameters (must be last)

// Debug endpoints
router.get('/test', (req, res) => {
  res.json({ 
    message: 'MP routes are working!', 
    timestamp: new Date().toISOString() 
  });
});

router.get('/status', async (req, res) => {
  try {
    const totalMPs = await Mp.countDocuments();
    const sampleMP = await Mp.findOne();
    
    res.json({
      message: 'MP database status',
      totalMPs,
      hasData: totalMPs > 0,
      sampleMP: sampleMP ? 'Found sample MP' : 'No MPs found',
      collectionName: Mp.collection.name,
      databaseName: Mp.db.name,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Database error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/debug', async (req, res) => {
  try {
    // Get database info
    const db = Mp.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Check if 'mp' collection exists
    const mpCollectionExists = collectionNames.includes('mp');
    const MPCollectionExists = collectionNames.includes('MP');
    
    res.json({
      message: 'Database debug info',
      databaseName: db.databaseName,
      collections: collectionNames,
      mpCollectionExists,
      MPCollectionExists,
      totalMPs: await Mp.countDocuments(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Debug error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// New endpoint to examine parliament_term values
router.get('/examine-terms', async (req, res) => {
  try {
    // Get all unique parliament_term values
    const termDistribution = await Mp.aggregate([
      {
        $group: {
          _id: '$parliament_term',
          count: { $sum: 1 },
          samples: { $push: { name: '$name', status: '$status', mp_id: '$mp_id' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get sample MPs from each term
    const termSamples = await Mp.aggregate([
      {
        $group: {
          _id: '$parliament_term',
          sampleMPs: { $push: { name: '$name', status: '$status', mp_id: '$mp_id', constituency: '$constituency' } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          term: '$_id',
          count: { $size: '$sampleMPs' },
          sampleMPs: { $slice: ['$sampleMPs', 5] } // Show first 5 MPs from each term
        }
      }
    ]);

    res.json({
      message: 'Parliamentary term examination',
      totalMPs: await Mp.countDocuments(),
      termDistribution,
      termSamples,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Term examination error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
