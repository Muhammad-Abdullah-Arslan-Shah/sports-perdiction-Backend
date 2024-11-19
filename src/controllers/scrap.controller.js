import {sportsArray} from "../utils/scrapingData.js"
import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import * as cheerio from 'cheerio';
import axios from 'axios';

// Create an index for quick lookup
const sportsIndex = {};
sportsArray.forEach((sport) => {
  sportsIndex[sport.name] = sport;
});
// send sport data 
const scrapeSports = asyncHandler(async(req, res) => {
    const sports = sportsArray.filter((sport) => sport.enabled);
   
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        sports,
        "Sports fetched successfully"
    ))
})

///////////////////////////////////////////////////////////////////////////////////////////////////
// scrap countries
const scrapeCountries = asyncHandler(async(req, res) => {
    
    try {
        const sport = req.query.sport;

        if (!sport) {
            throw new ApiError(400,"Sport parameter is required");
          }
        // scraping is start from there
        const webResponse = await fetch(`https://www.oddsportal.com/${sport}/`);
        const htmlContent = await webResponse.text();
    
        const countriesWithLeagues = [];
    
        const spanPattern =
          /<div class="[^">]*[\s\S]*?<span class="[^">]*">(.*?)<\/span>/gs;
    
        let match;
        while ((match = spanPattern.exec(htmlContent)) !== null) {
          const countryData = match[0];
          const logoMatch = countryData.match(/<img.*?src="(.*?)"/);
          const logoUrl = logoMatch ? logoMatch[1] : null;
          const countryName = match[1].trim();
    
          let leagues = [];
    
          // Find the next sibling div containing leagues
          const nextDivIndex = htmlContent.indexOf(
            '<div class="flex"',
            match.index + 1
          );
          if (nextDivIndex !== -1) {
            const endIndex = htmlContent.indexOf("</div>", nextDivIndex);
            const nextDiv = htmlContent.substring(nextDivIndex, endIndex);
            const leagueItems = nextDiv.match(/<li[^>]*>(.*?)<\/li>/gs);
            if (leagueItems) {
              for (const item of leagueItems) {
                const labelMatch = item.match(/<a[^>]*?>(.*?)<\/a>/);
                const label = labelMatch
                  ? labelMatch[1].replace(/\([^()]*\)/g, "").trim()
                  : null;
                const valueMatch = item.match(/<a.*?href="(.*?)"/);
                const value = valueMatch ? valueMatch[1] : null;
                leagues.push({ label, value });
              }
            }
          }
    
          countriesWithLeagues.push({ countryName, logoUrl, leagues });
        }
    
        return res
        .status(200)
        .json(new ApiResponse(
            200,
            countriesWithLeagues,
            "Countries with league fetched successfully"
        ))
      } catch (error) {
        console.error("Error occurred while scrape Countries:", error);
        return [];
      }
})
///////////////////////////////////////////////////////////////////////////////////////////////

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Timeout function with fetch
const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeout)
    ),
  ]);
};

// Helper function to perform fetch with retries
async function fetchWithRetries(url, options, timeout, retries, delay) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      console.warn(`Retrying fetch... (${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// Function to scrape matches data, wrapped in asyncHandler for error handling.
const scrapeMatches = asyncHandler(async (req, res) => {
  const league = req.query.league;
  if (!league) {
    throw new ApiError(400, "league parameter is required");
  }

  const matchesData = [];

  try {
    console.log("Fetching webpage for league:", league);
    const response = await fetchWithTimeout(league, {}, 10000); 
    console.log("League page fetched successfully with status:", response.status);

    const htmlContent = await response.text();
    console.log("HTML content length:", htmlContent.length);

    const eventIDs = [];
    let matchesOdds;
    const divPattern = /<div class="min-h-\[206px\]">(.*?)<\/div>/gs;
    let match;

    while ((match = divPattern.exec(htmlContent)) !== null) {
      const divContent = match[1];
      const eventIDMatches = divContent.match(/encodeEventId&quot;:&quot;([^&]*)&quot;/g);
      const oddsRequestMatches = divContent.match(/:odds-request="({.*?})"/);

      if (eventIDMatches) {
        console.log("Event IDs found:", eventIDMatches.length);
        for (const eventIDMatch of eventIDMatches) {
          const eventID = eventIDMatch.match(/encodeEventId&quot;:&quot;([^&]*)&quot;/)[1];
          eventIDs.push(eventID);
          console.log("Extracted Event ID:", eventID);
        }
      } else {
        console.log("No event IDs found in the div content.");
      }

      if (oddsRequestMatches && oddsRequestMatches.length > 0) {
        const oddsRequestString = oddsRequestMatches[1].replace(/&quot;/g, '"');
        console.log("Odds request string found:", oddsRequestString);

        if (isValidJSON(oddsRequestString)) {
          const oddsRequestObject = JSON.parse(oddsRequestString);
          const oddsRequestEndpoint = oddsRequestObject.url;
          const oddsRequestURL = "https://www.oddsportal.com" + oddsRequestEndpoint;

          console.log("Fetching odds data from:", oddsRequestURL);
          const responseOdds = await fetchWithRetries(oddsRequestURL, {}, 10000, MAX_RETRIES, RETRY_DELAY);

          if (responseOdds.ok) {
            console.log("Odds data fetched successfully.");
            const oddsContent = await responseOdds.text();
            matchesOdds = JSON.parse(oddsContent);
          } else {
            console.error("Failed to fetch odds data:", responseOdds.status, responseOdds.statusText);
          }
        } else {
          console.error("Invalid JSON in odds request string:", oddsRequestString);
        }
      } else {
        console.log("No :odds-request attribute found.");
      }
    }

    console.log("Event IDs to be processed:", eventIDs);

    if (eventIDs.length === 0) {
      console.log("No event IDs found. Returning empty array.");
      return res.status(200).json(new ApiResponse(200, [], "No matches found"));
    }

    await Promise.all(
      eventIDs.map(async (eventID) => {
        const matchData = {};
        const matchOdds = matchesOdds?.d?.oddsData?.[eventID]?.odds || [];
        const href = league + eventID;
        matchData.href = href;

        try {
          console.log("Fetching match data from:", href);
          const response = await fetchWithRetries(href, {}, 10000, MAX_RETRIES, RETRY_DELAY);

          if (!response.ok) {
            throw new Error("Failed to fetch page source");
          }
          console.log("Match page fetched successfully.");
          const htmlContent = await response.text();

          const startStartDateIndex =
            htmlContent.indexOf("startDate&quot;:") + "startDate&quot;:".length;
          const endStartDateIndex = htmlContent.indexOf(",", startStartDateIndex);

          if (startStartDateIndex !== -1 && endStartDateIndex !== -1) {
            const startDate = htmlContent.slice(startStartDateIndex, endStartDateIndex);
            matchData.startDateTimestamp = startDate;
            console.log("Start date extracted:", startDate);
          } else {
            console.log("Could not find startDate");
          }

          const startScriptIndex =
            htmlContent.indexOf('<script type="application/ld+json">') +
            '<script type="application/ld+json">'.length;
          const endScriptIndex = htmlContent.indexOf("</script>", startScriptIndex);

          const jsonLDContent = htmlContent.slice(startScriptIndex, endScriptIndex);
          const eventData = JSON.parse(jsonLDContent);

          matchData.homeTeamName = eventData.homeTeam.name;
          matchData.homeTeamLogo = eventData.homeTeam.image;
          matchData.awayTeamName = eventData.awayTeam.name;
          matchData.awayTeamLogo = eventData.awayTeam.image;
          matchData.eventStatus = eventData.eventStatus;
          matchData.odds = matchOdds.map((oddsItem) => oddsItem.avgOdds);

          console.log("Match data extracted:", matchData);
        } catch (error) {
          console.error("Error fetching page source:", error);
        }

        matchesData.push(matchData);
      })
    );

    console.log("All matches processed successfully.");
    return res.status(200).json(new ApiResponse(200, matchesData, "Matches fetched successfully"));
  } catch (error) {
    console.error("Error scraping matches:", error);
    throw new ApiError(500, "Failed to scrape matches");
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////

  
function extractSportNameFromUrl(url) {
  const urlParts = url.split("/");
  return urlParts.find((part) => sportsIndex[part]);
}


const scrapeMatchResult = asyncHandler(async(req, res) => {
  try {
    const matchUrl = req.query.match;
    const sportName = extractSportNameFromUrl(matchUrl);
    const sportObject = sportsIndex[sportName];

    if (!sportObject) {
      throw new Error(`Sport ${sportName} not found`);
    }

    const matchData = {};
    const response = await fetch(matchUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch match page source");
    }

    const htmlContent = await response.text();

    if (matchData.eventStatus !== "Scheduled") {
      const startPartialResultIndex =
        htmlContent.indexOf("partialresult&quot;:&quot;") +
        "partialresult&quot;:&quot;".length;
      const endPartialResultIndex = htmlContent.indexOf(
        "&quot;",
        startPartialResultIndex
      );

      if (startPartialResultIndex !== -1 && endPartialResultIndex !== -1) {
        const partialResult = htmlContent.slice(
          startPartialResultIndex,
          endPartialResultIndex
        );
        matchData.partialResult = partialResult;
      } else {
        console.log("Could not find partialresult");
      }

      const startHomeResultIndex =
        htmlContent.indexOf("homeResult&quot;:&quot;") +
        "homeResult&quot;:&quot;".length;
      const endHomeResultIndex = htmlContent.indexOf(
        "&quot;",
        startHomeResultIndex
      );

      if (startHomeResultIndex !== -1 && endHomeResultIndex !== -1) {
        const homeResult = htmlContent.slice(
          startHomeResultIndex,
          endHomeResultIndex
        );
        matchData.homeResult = homeResult;
      } else {
        console.log("Could not find homeResult");
      }

      const startAwayResultIndex =
        htmlContent.indexOf("awayResult&quot;:&quot;") +
        "awayResult&quot;:&quot;".length;
      const endAwayResultIndex = htmlContent.indexOf(
        "&quot;",
        startAwayResultIndex
      );

      if (startAwayResultIndex !== -1 && endAwayResultIndex !== -1) {
        const awayResult = htmlContent.slice(
          startAwayResultIndex,
          endAwayResultIndex
        );
        matchData.awayResult = awayResult;
      } else {
        console.log("Could not find awayResult");
      }
    }

    const { partialResult, homeResult, awayResult } = matchData;
    console.log("Match Result", matchData);
    let homeScore, awayScore;

    const checkPartial =
      partialResult && sportObject && sportObject.handleDirectResult === false;

    if (homeResult === "" && awayResult === "") {
      homeScore = "";
      awayScore = "";
    } else if (homeResult === undefined && awayResult === undefined) {
      homeScore = undefined;
      awayScore = undefined;
    } else if (checkPartial) {
      const partialSum = sportObject.partialSum || 2;
      const results = partialResult
        .split(",")
        .map((ratio) => ratio.split(":").map(Number));

      homeScore = results
        .slice(0, partialSum)
        .reduce((sum, scores) => sum + scores[0], 0);
      awayScore = results
        .slice(0, partialSum)
        .reduce((sum, scores) => sum + scores[1], 0);
    } else {
      homeScore = parseInt(homeResult, 10);
      awayScore = parseInt(awayResult, 10);
    }

    const results = { homeScore, awayScore }
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        results,
        "Sports fetched successfully"
    ))
   
  } catch (error) {
    console.error("Error scraping match result:", error);
    return { homeScore: undefined, awayScore: undefined };
  }
 
  
})

  
export {
    
scrapeSports,
scrapeCountries,
scrapeMatches,

}