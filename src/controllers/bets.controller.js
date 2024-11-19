import {Bet} from '../models/bet.model.js'; // Import the Bet model
import{ User} from '../models/user.model.js'; // Import the User model for user-related operations

// Create a new bet
export const createBet = async (req, res) => {
  try {
    const { matches, amount } = req.body; // Extract matches and amount from the request body

    // Assuming you have the user ID from the authenticated session or token
    const userId = req.user._id; // Get the user ID from the authenticated user (assuming you have middleware to attach this)

    // Create a new Bet document
    const newBet = new Bet({
      betBy: userId, // Associate the bet with the user
      matches,      // Include the matches in the bet
      amount,       // Set the amount of the bet
    });

    // Save the bet to the database
    const savedBet = await newBet.save();

    // Optionally, associate the bet with the user (if User schema tracks bets)
    await User.findByIdAndUpdate(userId, { $push: { bets: savedBet._id } });

    // Send a success response with the saved bet
    res.status(201).json({
      message: 'Bet created successfully', // Success message
      bet: savedBet,                      // Return the saved bet
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({
      message: 'Error creating bet', // Error message for the client
      error: error.message,          // Provide the error details
    });
  }
};

// Get all bets
export const getAllBets = async (req, res) => {
  try {
    // Find all bets and populate the `betBy` field with the user's username
    const bets = await Bet.find().populate('betBy', 'username');
    
    // Send the retrieved bets in the response
    res.status(200).json(bets);
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({
      message: 'Error retrieving bets', // Error message for the client
      error: error.message,             // Provide the error details
    });
  }
};

// Get a single bet by ID
export const getBetById = async (req, res) => {
  try {
    // Find the bet by ID and populate the `betBy` field with the user's username
    const bet = await Bet.findById(req.params.id).populate('betBy', 'username');

    if (!bet) {
      return res.status(404).json({
        message: 'Bet not found', // Error message if the bet is not found
      });
    }

    // Send the found bet in the response
    res.status(200).json(bet);
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({
      message: 'Error retrieving bet', // Error message for the client
      error: error.message,            // Provide the error details
    });
  }
};

// Get all bets for a specific user
export const getUserBets = async (req, res) => {
  try {
    // Get user ID from the request parameters
    const userId = req.user._id;

    // Find all bets associated with the user
    const bets = await Bet.find({ betBy: userId }).populate('betBy', 'username');

    if (bets.length === 0) {
      return res.status(404).json({
        message: 'No bets found for this user', // Error message if no bets are found
      });
    }

    // Send the retrieved bets in the response
    res.status(200).json(bets);
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({
      message: 'Error retrieving user bets', // Error message for the client
      error: error.message,                  // Provide the error details
    });
  }
};

// Delete a bet by ID
export const deleteBet = async (req, res) => {
  try {
    // Find the bet by ID and delete it
    const deletedBet = await Bet.findByIdAndDelete(req.params.id);

    if (!deletedBet) {
      return res.status(404).json({
        message: 'Bet not found', // Error message if the bet is not found
      });
    }

    // Send a success response confirming deletion
    res.status(200).json({
      message: 'Bet deleted successfully', // Success message
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({
      message: 'Error deleting bet', // Error message for the client
      error: error.message,          // Provide the error details
    });
  }
};
