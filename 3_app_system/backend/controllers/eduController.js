const eduService = require('../services/eduService');

exports.getAllEdu = async (req, res) => {
  try {
    console.log('API endpoint /api/edu called');
    const data = await eduService.getAllPublishedEdu();
    console.log('Successfully fetched educational resources:', data.length, 'items');
    res.json(data);
  } catch (err) {
    console.error('Error in getAllEdu controller:', err);
    res.status(500).json({ message: "Failed to get educational resources", error: err.message });
  }
};

exports.getEduById = async (req, res) => {
  try {
    const edu = await eduService.getEduById(req.params.id);
    res.json(edu);
  } catch (err) {
    if (err.message === 'Educational resource not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to get educational resource", error: err.message });
  }
};
