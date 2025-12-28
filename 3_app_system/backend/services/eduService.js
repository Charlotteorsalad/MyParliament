const { EduResource } = require('../models/EduResource');

class EduService {
  async getAllPublishedEdu() {
    try {
      console.log('Fetching published educational resources...');
      const data = await EduResource.find({ status: 'published' })
        .sort({ createdAt: -1 });
      
      console.log(`Found ${data.length} published resources`);
      
      // Debug: Log first item's image and quiz structure
      if (data.length > 0) {
        console.log('First item image structure:', data[0].image ? 'EXISTS' : 'NULL');
        if (data[0].image) {
          console.log('Image keys:', Object.keys(data[0].image));
          console.log('Image data length:', data[0].image.data?.length);
          console.log('Image contentType:', data[0].image.contentType);
          console.log('Image size:', data[0].image.size);
        }
      }
      
      // Transform data to ensure frontend gets the expected field names
      const transformedData = data.map(item => {
        try {
          const obj = item.toObject();
          return {
            ...obj,
            title: obj.title || obj.name || 'Untitled', // Use title if available, otherwise use name, fallback to 'Untitled'
            name: obj.name || obj.title || 'Untitled',   // Keep both fields for compatibility
            description: obj.description || 'No description available', // Provide fallback for description
            content: obj.content || obj.description || 'No content available', // Provide fallback for content
            quiz: obj.quiz || null, // Preserve quiz data
            contentAttachments: obj.contentAttachments || [], // Content-specific attachments
            quizAttachments: obj.quizAttachments || [], // Quiz-specific attachments
            attachments: obj.attachments || [] // Keep old attachments for backward compatibility
          };
        } catch (transformError) {
          console.error('Error transforming item:', transformError);
          return {
            _id: item._id,
            name: 'Untitled',
            title: 'Untitled',
            description: 'No description available',
            content: 'No content available',
            category: 'other',
            status: 'published',
            quiz: null,
            contentAttachments: [],
            quizAttachments: [],
            attachments: []
          };
        }
      });
      
      console.log('Data transformation completed');
      return transformedData;
    } catch (error) {
      console.error('Error in getAllPublishedEdu:', error);
      throw error;
    }
  }

  async getEduById(eduId) {
    console.log('getEduById called with ID:', eduId);
    const edu = await EduResource.findById(eduId);
    
    if (!edu) {
      throw new Error('Educational resource not found');
    }
    
    
    // Transform data to ensure frontend gets the expected field names
    const result = {
      ...edu.toObject(),
      title: edu.title || edu.name, // Use title if available, otherwise use name
      name: edu.name || edu.title,   // Keep both fields for compatibility
      quiz: edu.quiz || null, // Preserve quiz data
      contentAttachments: edu.contentAttachments || [], // Content-specific attachments
      quizAttachments: edu.quizAttachments || [], // Quiz-specific attachments
      attachments: edu.attachments || [] // Keep old attachments for backward compatibility
    };
    
    return result;
  }

  async getEduByStatus(status) {
    const data = await EduResource.find({ status })
      .sort({ createdAt: -1 });
    
    // Transform data to ensure frontend gets the expected field names
    return data.map(item => ({
      ...item.toObject(),
      title: item.title || item.name,
      name: item.name || item.title,
      quiz: item.quiz || null, // Preserve quiz data
      contentAttachments: item.contentAttachments || [], // Content-specific attachments
      quizAttachments: item.quizAttachments || [], // Quiz-specific attachments
      attachments: item.attachments || [] // Keep old attachments for backward compatibility
    }));
  }

  async searchEdu(query, filters = {}) {
    const searchQuery = {
      ...filters,
      $text: { $search: query }
    };
    
    const data = await EduResource.find(searchQuery)
      .sort({ score: { $meta: "textScore" } })
      .sort({ createdAt: -1 });
    
    // Transform data to ensure frontend gets the expected field names
    return data.map(item => ({
      ...item.toObject(),
      title: item.title || item.name,
      name: item.name || item.title,
      quiz: item.quiz || null, // Preserve quiz data
      contentAttachments: item.contentAttachments || [], // Content-specific attachments
      quizAttachments: item.quizAttachments || [], // Quiz-specific attachments
      attachments: item.attachments || [] // Keep old attachments for backward compatibility
    }));
  }

  async getEduByCategory(category) {
    const data = await EduResource.find({ 
      category,
      status: 'published' 
    }).sort({ createdAt: -1 });
    
    // Transform data to ensure frontend gets the expected field names
    return data.map(item => ({
      ...item.toObject(),
      title: item.title || item.name,
      name: item.name || item.title,
      quiz: item.quiz || null, // Preserve quiz data
      contentAttachments: item.contentAttachments || [], // Content-specific attachments
      quizAttachments: item.quizAttachments || [], // Quiz-specific attachments
      attachments: item.attachments || [] // Keep old attachments for backward compatibility
    }));
  }
}

module.exports = new EduService();
