const mpService = require('../services/mpService');

exports.getFeatured = async (req, res) => {
  try {
    const data = await mpService.getFeaturedMPs();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: "Failed to get featured MPs", error: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await mpService.getMPStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Failed to get MP stats", error: err.message });
  }
};

exports.getList = async (req, res) => {
  try {
    const result = await mpService.getMPList(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to get MP list", error: err.message });
  }
};

exports.getDetail = async (req, res) => {
  try {
    const mp = await mpService.getMPDetail(req.params.id);
    res.json({ data: mp });
  } catch (err) {
    if (err.message === 'MP not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Failed to get MP details", error: err.message });
  }
};
