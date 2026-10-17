const User = require('../models/User');
const Audit = require('../models/Audit');
const { uid, hash } = require('../utils/helpers');

// GET /api/users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}, { _id: 0, __v: 0 });
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// POST /api/users (Admin creates authority account with custom password)
exports.createAuthorityUser = async (req, res, next) => {
  try {
    const { role, name, email, password, scope, adminId } = req.body;
    if (!role || !name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, email, and password (min 6 characters) are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });

    const newUser = new User({
      id: uid(),
      role,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: hash(password),
      isActive: true,
      mustChange: false,
      scope: scope || {},
      createdAt: Date.now()
    });

    await newUser.save();

    await Audit.create({
      id: uid(),
      leaveId: null,
      actorId: adminId || 'admin',
      action: 'CREATE_ACCOUNT',
      from: null,
      to: newUser.id,
      at: Date.now()
    });

    res.json({ success: true, user: newUser.toObject() });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id (Edit scope/name, toggle active, admin set new password)
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, scope, isActive, password } = req.body;

    const user = await User.findOne({ id });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (name) user.name = name.trim();
    if (scope) user.scope = scope;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password && password.length >= 6) {
      user.passwordHash = hash(password);
      user.mustChange = false;
    }

    await user.save();
    res.json({ success: true, user: user.toObject() });
  } catch (err) {
    next(err);
  }
};
