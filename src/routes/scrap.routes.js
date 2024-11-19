import { Router } from 'express';
import { 
    scrapeSports,
    scrapeCountries,
    scrapeMatches,
    scrapeMatchResult
} from '../controllers/scrap.controller.js';

const router = Router();

router.route("/scrapeSports").get(scrapeSports);
router.route("/scrapeCountries").get(scrapeCountries);
router.route("/scrapeMatches").get(scrapeMatches);
router.route("/scrapeMatchResult").get(scrapeMatchResult);

export default router