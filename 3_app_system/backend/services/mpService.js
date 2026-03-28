const Mp = require('../models/Mp');
const User = require('../models/User');

class MpService {
  // Base aggregation stage for scoring MPs
  _getBaseScoreStage() {
    return {
      $addFields: {
        _isCurrent: { $cond: [{ $eq: ['$status', 'current'] }, 1, 0] },
        _isCabinet: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$positionInCabinet', ''] } }, 0] }, 1, 0] },
        _hasProfile: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$profilePicture', ''] } }, 0] }, 1, 0] },
        _hasContacts: {
          $cond: [
            { $gt: [
              { $size: {
                $filter: {
                  input: [{ $ifNull: ['$email',''] }, { $ifNull: ['$phone',''] }, { $ifNull: ['$address',''] }],
                  as: 'c', cond: { $gt: [{ $strLenCP: '$$c' }, 0] }
                }}}, 0]
            }, 1, 0]
        },
        _isTerm15: { $cond: [{ $eq: ['$parliament_term', '15th'] }, 1, 0] }
      }
    };
  }

  async getFeaturedMPs() {
    // Only MPs with ALL 5 performance metrics are eligible as "featured".
    // Composite score formula (weights sum to 1):
    //   40% attendance  +  20% responseRate  +  15% sentimentScore
    //   +  10% askRate  +  10% escalateRate  +   5% interjectionRate
    // All inputs are 0-100; result is 0-100.
    const data = await Mp.aggregate([
      {
        $match: {
          status: 'current',
          'performance.attendanceRate':   { $ne: null, $type: 'number' },
          'performance.responseRate':     { $ne: null, $type: 'number' },
          'performance.askRate':          { $ne: null, $type: 'number' },
          'performance.escalateRate':     { $ne: null, $type: 'number' },
          'performance.interjectionRate': { $ne: null, $type: 'number' },
          'performance.sentimentScore':   { $ne: null, $type: 'number' },
        },
      },
      {
        $addFields: {
          performanceScore: {
            $add: [
              { $multiply: [0.40, '$performance.attendanceRate'] },
              { $multiply: [0.20, '$performance.responseRate'] },
              { $multiply: [0.15, '$performance.sentimentScore'] },
              { $multiply: [0.10, '$performance.askRate'] },
              { $multiply: [0.10, '$performance.escalateRate'] },
              { $multiply: [0.05, '$performance.interjectionRate'] },
            ],
          },
        },
      },
      { $sort: { performanceScore: -1, name: 1 } },
      { $limit: 40 },
      {
        $project: {
          _id: 1, mp_id: 1, name: 1, full_name_with_titles: 1,
          party: 1, party_full_name: 1,
          constituency: 1, constituency_code: 1, constituency_name: 1,
          state: 1, profilePicture: 1, status: 1, parliament_term: 1,
          performanceScore: { $round: ['$performanceScore', 1] },
          'performance.attendanceRate':   1,
          'performance.responseRate':     1,
          'performance.askRate':          1,
          'performance.escalateRate':     1,
          'performance.interjectionRate': 1,
          'performance.sentimentScore':   1,
        },
      },
    ]);

    return data;
  }

  // Featured MPs across all recorded terms (not limited to current only)
  async getFeaturedMPsAllTime() {
    const data = await Mp.aggregate([
      {
        $match: {
          // Allow any status, but still require full performance metrics
          'performance.attendanceRate':   { $ne: null, $type: 'number' },
          'performance.responseRate':     { $ne: null, $type: 'number' },
          'performance.askRate':          { $ne: null, $type: 'number' },
          'performance.escalateRate':     { $ne: null, $type: 'number' },
          'performance.interjectionRate': { $ne: null, $type: 'number' },
          'performance.sentimentScore':   { $ne: null, $type: 'number' },
        },
      },
      {
        $addFields: {
          performanceScore: {
            $add: [
              { $multiply: [0.40, '$performance.attendanceRate'] },
              { $multiply: [0.20, '$performance.responseRate'] },
              { $multiply: [0.15, '$performance.sentimentScore'] },
              { $multiply: [0.10, '$performance.askRate'] },
              { $multiply: [0.10, '$performance.escalateRate'] },
              { $multiply: [0.05, '$performance.interjectionRate'] },
            ],
          },
        },
      },
      { $sort: { performanceScore: -1, name: 1 } },
      { $limit: 80 },
      {
        $project: {
          _id: 1, mp_id: 1, name: 1, full_name_with_titles: 1,
          party: 1, party_full_name: 1,
          constituency: 1, constituency_code: 1, constituency_name: 1,
          state: 1, profilePicture: 1, status: 1, parliament_term: 1,
          performanceScore: { $round: ['$performanceScore', 1] },
          'performance.attendanceRate':   1,
          'performance.responseRate':     1,
          'performance.askRate':          1,
          'performance.escalateRate':     1,
          'performance.interjectionRate': 1,
          'performance.sentimentScore':   1,
        },
      },
    ]);

    return data;
  }

  async getMPStats() {
    const [kpis] = await Mp.aggregate([
      { 
        $group: {
          _id: null,
          totalMPs: { $sum: 1 },
          activeMPs: { $sum: { $cond: [{ $eq: ['$status', 'current'] }, 1, 0] } },
          parties: { $addToSet: '$party' },
          states: { $addToSet: '$state' }
        }
      },
      { 
        $project: {
          _id: 0,
          totalMPs: 1, activeMPs: 1,
          distinctParties: { $size: '$parties' },
          distinctStates: { $size: '$states' }
        }
      }
    ]);

    const partyDist = await Mp.aggregate([
      { $group: { _id: '$party', count: { $sum: 1 } } }, 
      { $sort: { count: -1 } }
    ]);
    
    const stateDist = await Mp.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } }, 
      { $sort: { count: -1 } }
    ]);

    const kpisData = kpis || { totalMPs: 0, activeMPs: 0, distinctParties: 0, distinctStates: 0 };
    
    return { 
      total: kpisData.totalMPs,
      active: kpisData.activeMPs,
      constituencies: kpisData.distinctStates,
      parties: kpisData.distinctParties,
      partyDistribution: partyDist, 
      stateDistribution: stateDist 
    };
  }

  async getMPList(queryParams) {
    const { party, state, term, status, q, limit = 24, page = 1, sort = 'all-current', search } = queryParams;

    // Build filter object
    const filter = {};
    if (party) filter.party = { $in: party.split(',') };
    if (state) filter.state = { $in: state.split(',') };
    if (term) {
      const terms = term.split(',');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { parliament_term: { $in: terms } },
          { 'parliamentary_history.parliament_term': { $in: terms } }
        ]
      });
    }
    if (status) filter.status = status;
    
    // Handle search - name, party (short or full name), state, constituency (name or code e.g. P020)
    if (search && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(term, 'i');
      const searchCondition = {
        $or: [
          { name: searchRegex },
          { party: searchRegex },
          { party_full_name: searchRegex },
          { state: searchRegex },
          { constituency: searchRegex },
          { constituency_code: searchRegex },
          { constituency_name: searchRegex }
        ]
      };
      if (filter.$and) {
        filter.$and.push(searchCondition);
      } else {
        filter.$or = searchCondition.$or;
      }
    } else if (q) {
      filter.$text = { $search: q };
    }

    // Universal dedup: some MPs have multiple documents (one per parliament term).
    // If a current document exists for a person, always suppress their historical
    // duplicates — even in "Inactive MPs" view. A person who is currently active
    // should never appear as inactive.
    const currentMpNames = await Mp.distinct('name', { ...filter, status: 'current' });
    if (currentMpNames.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { status: 'current' },
          { name: { $nin: currentMpNames } }
        ]
      });
    }

    // Build the complete filter for accurate total count
    let totalFilter = { ...filter };
    
    // Apply party filter to total count if it's a party-specific sort
    if (sort === 'bn') {
      totalFilter.party = 'BN';
    } else if (sort === 'ph') {
      totalFilter.party = 'PH';
    } else if (sort === 'pn') {
      totalFilter.party = 'PN';
    } else if (sort === 'warisan') {
      totalFilter.party = 'Warisan';
    } else if (sort === 'muda') {
      totalFilter.party = 'MUDA';
    } else if (sort === 'independent') {
      totalFilter.party = 'Independent';
    }
    
    const total = await Mp.countDocuments(totalFilter);

    try {
      console.log('Building aggregation pipeline for sort:', sort);
      console.log('Base filter:', JSON.stringify(filter));
      console.log('Total count filter:', JSON.stringify(totalFilter));
      console.log('Sort type:', sort);
      console.log('Status filter value:', status);
      console.log('Sorting by: status: -1 (active first), name: 1 (alphabetical)');
      
      // Use aggregation for practical MP filtering and sorting
      const pipeline = [
        { $match: filter }
      ];

      // Add sorting based on the sort parameter
      if (sort === 'all-current') {
        // Show all MPs, but prioritize current ones
        pipeline.push({ $sort: { status: -1, name: 1 } });
      } else if (sort === 'bn') {
        // Filter to show only BN party MPs
        pipeline.push({ $match: { party: 'BN' } });
        pipeline.push({ $sort: { name: 1 } });
      } else if (sort === 'ph') {
        // Filter to show only PH party MPs
        pipeline.push({ $match: { party: 'PH' } });
        pipeline.push({ $sort: { name: 1 } });
      } else if (sort === 'pn') {
        // Filter to show only PN party MPs
        pipeline.push({ $match: { party: 'PN' } });
        pipeline.push({ $sort: { name: 1 } });
      } else if (sort === 'warisan') {
        // Filter to show only Warisan party MPs
        pipeline.push({ $match: { party: 'Warisan' } });
        pipeline.push({ $sort: { name: 1 } });
      } else if (sort === 'muda') {
        // Filter to show only MUDA party MPs
        pipeline.push({ $match: { party: 'MUDA' } });
        pipeline.push({ $sort: { name: 1 } });
      } else if (sort === 'independent') {
        // Filter to show only Independent MPs
        pipeline.push({ $match: { party: 'Independent' } });
        pipeline.push({ $sort: { name: 1 } });
      } else {
        // Default: show all MPs with current first
        pipeline.push({ $sort: { status: -1, name: 1 } });
      }

      // Add pagination
      pipeline.push(
        { $skip: (page - 1) * +limit },
        { $limit: +limit },
        {
          $project: {
            _id: 1, mp_id: 1, name: 1, party: 1, constituency: 1, constituency_code: 1, constituency_name: 1, state: 1,
            honorifics: 1, profilePicture: 1, status: 1, parliament_term: 1
          }
        }
      );

      console.log('Final pipeline:', JSON.stringify(pipeline, null, 2));
      console.log('Sorting logic: Party-based system - all-current, bn, ph, pn, warisan, muda, independent');
      const data = await Mp.aggregate(pipeline);
      console.log('Aggregation successful, returned', data.length, 'documents');
      
      // Debug: Log the first few results to see what we're getting
      console.log('First 5 results:');
      data.slice(0, 5).forEach((mp, index) => {
        console.log(`${index + 1}. ${mp.name} - Party: ${mp.party} - Status: ${mp.status}`);
      });
      
      // Debug: Show status distribution in results
      const statusCounts = {};
      data.forEach(mp => {
        statusCounts[mp.status] = (statusCounts[mp.status] || 0) + 1;
      });
      console.log('Status distribution in results:', statusCounts);
      
      return { data, meta: { total, page: +page, limit: +limit } };

    } catch (error) {
      console.error('Aggregation error:', error);
      
      // Fallback to simple find if aggregation fails
      let sortBy;
      let fallbackFilter = { ...filter };
      
      if (sort === 'bn') {
        fallbackFilter.party = 'BN';
        sortBy = { name: 1 };
      } else if (sort === 'ph') {
        fallbackFilter.party = 'PH';
        sortBy = { name: 1 };
      } else if (sort === 'pn') {
        fallbackFilter.party = 'PN';
        sortBy = { name: 1 };
      } else if (sort === 'warisan') {
        fallbackFilter.party = 'Warisan';
        sortBy = { name: 1 };
      } else if (sort === 'muda') {
        fallbackFilter.party = 'MUDA';
        sortBy = { name: 1 };
      } else if (sort === 'independent') {
        fallbackFilter.party = 'Independent';
        sortBy = { name: 1 };
      } else {
        sortBy = { status: -1, name: 1 }; // Default: active MPs first, then inactive
      }

      const data = await Mp.find(fallbackFilter, {
        _id: 1, mp_id: 1, name: 1, party: 1, constituency: 1, constituency_code: 1, constituency_name: 1, state: 1,
        honorifics: 1, profilePicture: 1, status: 1, parliament_term: 1
      })
        .sort(sortBy)
        .skip((page - 1) * +limit)
        .limit(+limit)
        .lean();

      return { data, meta: { total, page: +page, limit: +limit } };
    }
  }

  async getMPDetail(mpId) {
    const mongoose = require('mongoose');
    let mp = null;
    if (typeof mpId === 'string' && /^[0-9a-fA-F]{24}$/.test(mpId)) {
      try {
        mp = await Mp.findById(mpId).select(
          '_id mp_id name full_name_with_titles honorifics party party_full_name constituency constituency_code constituency_name positionInParliament parliament_term status service profilePicture profile_url state positionInCabinet seatNumber phone fax email address created_at performance parliamentary_history'
        ).lean();
      } catch {
        mp = null;
      }
    }
    if (!mp) {
      mp = await Mp.findOne(
        { mp_id: mpId },
        {
          _id: 1, mp_id: 1, name: 1, full_name_with_titles: 1, honorifics: 1,
          party: 1, party_full_name: 1, constituency: 1, constituency_code: 1, constituency_name: 1,
          positionInParliament: 1, parliament_term: 1, status: 1, service: 1,
          profilePicture: 1, profile_url: 1, state: 1, positionInCabinet: 1,
          seatNumber: 1, phone: 1, fax: 1, email: 1, address: 1, created_at: 1, performance: 1,
          parliamentary_history: 1
        }
      ).lean();
    }
    if (!mp) {
      throw new Error('MP not found');
    }
    const followerIdStr = String(mp._id);
    let followerCount;
    if (mongoose.Types.ObjectId.isValid(followerIdStr)) {
      const legacyId = new mongoose.Types.ObjectId(followerIdStr);
      followerCount = await User.countDocuments({
        $or: [
          { followedMPs: followerIdStr },
          { followedMPs: legacyId },
        ],
      });
    } else {
      followerCount = await User.countDocuments({ followedMPs: followerIdStr });
    }
    return { ...mp, followerCount };
  }

  async getMPDetailByName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('MP not found');
    }
    const trimmed = name.trim();
    const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const mp = await Mp.findOne({
      $or: [
        { name: regex },
        { full_name_with_titles: regex },
      ],
    }, {
      _id: 1, mp_id: 1, name: 1, full_name_with_titles: 1, honorifics: 1,
      party: 1, party_full_name: 1, constituency: 1, constituency_code: 1, constituency_name: 1,
      positionInParliament: 1, parliament_term: 1, status: 1, service: 1,
      profilePicture: 1, profile_url: 1, state: 1, positionInCabinet: 1,
      seatNumber: 1, phone: 1, fax: 1, email: 1, address: 1, created_at: 1,
      parliamentary_history: 1,
    }).lean();

    if (!mp) {
      throw new Error('MP not found');
    }

    const mongoose = require('mongoose');
    const followerIdStr = String(mp._id);
    let followerCount;
    if (mongoose.Types.ObjectId.isValid(followerIdStr)) {
      const legacyId = new mongoose.Types.ObjectId(followerIdStr);
      followerCount = await User.countDocuments({
        $or: [
          { followedMPs: followerIdStr },
          { followedMPs: legacyId },
        ],
      });
    } else {
      followerCount = await User.countDocuments({ followedMPs: followerIdStr });
    }
    return { ...mp, followerCount };
  }
}

module.exports = new MpService();
