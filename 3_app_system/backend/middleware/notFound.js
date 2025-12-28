// Not found
module.exports = (req, res) => {
    res.status(404).json({ error: { message: 'Not Found', status: 404 } });
  };