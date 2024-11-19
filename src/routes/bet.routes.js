import { Router } from 'express';
import { 
  createBet, 
  getAllBets, 
  getBetById, 
  deleteBet ,
  getUserBets
} from '../controllers/bets.controller.js';
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

// Apply verifyJWT middleware to all routes
router.use(verifyJWT);

// Route to create a new bet 
router.post('/createBet', createBet);

// Route to get all bets
router.get('/Allbets', getAllBets);

// Route to get a single bet by ID
router.get('/bet/:id', getBetById);

// Route to get a single bet by ID
router.get('/getUserBet',  getUserBets);

// Route to delete a bet by ID
router.delete('/delBet/:id', deleteBet);

export default router;
