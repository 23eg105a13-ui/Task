import { Router } from 'express';
import {
  analyzeProfile,
  listProfiles,
  getProfile,
  deleteProfile,
  getStatsSummary,
} from '../controllers/profileController';
import { validateUsername } from '../middleware/validators';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Order matters: /stats/summary must be registered before /:username
// or Express will treat "stats" as a :username path param.
router.get('/stats/summary', asyncHandler(getStatsSummary));

router.post('/analyze', validateUsername, asyncHandler(analyzeProfile));
router.get('/', asyncHandler(listProfiles));
router.get('/:username', validateUsername, asyncHandler(getProfile));
router.delete('/:username', validateUsername, asyncHandler(deleteProfile));

export default router;
