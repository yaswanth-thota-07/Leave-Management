const FileDoc = require('../models/FileDoc');

// POST /api/files
exports.uploadFile = async (req, res, next) => {
  try {
    const { id, name, type, size, data } = req.body;
    if (!id || !name || !data) return res.status(400).json({ error: 'Missing file payload' });
    const newFile = new FileDoc({ id, name, type, size, data });
    await newFile.save();
    res.json({ success: true, id });
  } catch (err) {
    next(err);
  }
};

// GET /api/files/:id
exports.getFile = async (req, res, next) => {
  try {
    const file = await FileDoc.findOne({ id: req.params.id });
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json({ id: file.id, name: file.name, type: file.type, size: file.size, data: file.data });
  } catch (err) {
    next(err);
  }
};
