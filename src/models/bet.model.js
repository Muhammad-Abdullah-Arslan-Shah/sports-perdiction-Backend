import mongoose from 'mongoose';  // Import mongoose for working with MongoDB
const Schema = mongoose.Schema;    // Get the Schema constructor from mongoose

// Define the Match schema within the Bet schema
const matchSchema = new Schema({
  timeStamp: {
    type: String,  // The timestamp of when the match occurs (can be a date string)
    required: true,  // This field is required
  },
  homeTeamLogo: String,  // URL to the logo of the home team
  awayTeamLogo: String,  // URL to the logo of the away team
  homeTeamName: String,  // Name of the home team
  awayTeamName: String,  // Name of the away team
  selectedOdd: {
    type: Number,  // The odds selected for this match in the bet
    required: true,  // This field is required
  },
  betType: {
    type: String,  // Type of bet (home win, away win, or draw)
    enum: ["home", "away", "draw"],  // Restrict values to "home", "away", or "draw"
    required: true,  // This field is required
  },
  Link: String,  // Optional link to more information about the match
});

// Define the Bet schema
const betSchema = new Schema(
  {
    betBy: {
      type: Schema.Types.ObjectId,  // Reference to the User who placed the bet
      ref: "User",  // Referencing the User model
    },
    matches: [
      
         {
          type: matchSchema,  // The match schema defined above, embedded in an array
          required: true,  // Each match in the array is required
        }
    
    ],
    amount: {
      type: Number,  // The amount of money placed on the bet
      required: true,  // This field is required
    },
  },
  {
    timestamps: true,  // Automatically create `createdAt` and `updatedAt` fields
  }
);

// Create and export the Bet model
export const Bet = mongoose.model("Bet", betSchema);  // Create a model called "Bet" based on the betSchema
  // Export the Bet model for use in other parts of the application
