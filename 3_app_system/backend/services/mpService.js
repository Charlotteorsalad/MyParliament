const Mp = require('../models/Mp');

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
    const data = await Mp.aggregate([
      this._getBaseScoreStage(),
      { 
        $addFields: {
          baseScore: {
            $add: [
              { $multiply: [200, '$_isCurrent'] },
              { $multiply: [120, '$_isCabinet'] },
              { $multiply: [50, '$_hasProfile'] },
              { $multiply: [30, '$_hasContacts'] },
              { $multiply: [20, '$_isTerm15'] },
              { $multiply: [10, { $cond: [{ $gt: [{ $size: { $ifNull: ['$honorifics', []] } }, 0] }, 1, 0] }] }
            ]
          }
        }
      },
      { $sort: { baseScore: -1, name: 1 } },
      { $limit: 12 },
      { 
        $project: {
          _id: 0, mp_id: 1, name: 1, party: 1, constituency: 1,
          profilePicture: 1, status: 1, parliament_term: 1, baseScore: 1
        }
      }
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
    if (term) filter.parliament_term = { $in: term.split(',') };
    if (status) filter.status = status;
    
    // Handle search - search in name or party
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { party: searchRegex }
      ];
    } else if (q) {
      // Fallback to old text search if no new search parameter
      filter.$text = { $search: q };
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
    
    // Get total count with complete filters
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
            _id: 0, mp_id: 1, name: 1, party: 1, constituency: 1,
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
        _id: 0, mp_id: 1, name: 1, party: 1, constituency: 1,
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
    const mp = await Mp.findOne(
      { mp_id: mpId },
      {
        _id: 0, mp_id: 1, name: 1, full_name_with_titles: 1, honorifics: 1,
        party: 1, party_full_name: 1, constituency: 1, constituency_code: 1, constituency_name: 1,
        positionInParliament: 1, parliament_term: 1, status: 1, service: 1,
        profilePicture: 1, profile_url: 1, state: 1, positionInCabinet: 1,
        seatNumber: 1, phone: 1, fax: 1, email: 1, address: 1, created_at: 1
      }
    ).lean();

    if (!mp) {
      throw new Error('MP not found');
    }

    return mp;
  }
}

module.exports = new MpService();
