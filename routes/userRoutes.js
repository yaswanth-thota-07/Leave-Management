const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);
router.post('/', userController.createAuthorityUser);
router.patch('/:id', userController.updateUser);

module.exports = router;
