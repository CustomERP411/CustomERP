const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(authenticateToken, requireAdmin);

router.get('/', adminController.listUsers);
router.get('/projects', adminController.listAllProjects);
router.put('/:userId', adminController.updateUser);
router.put('/:userId/admin', adminController.setAdminStatus);
router.delete('/:userId', adminController.deleteUser);

module.exports = router;
