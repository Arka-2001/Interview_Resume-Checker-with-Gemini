require("dotenv").config();

const connectToDB = require("./src/config/database");
const app = require("./src/app");
const { generateIneterviewReport } = require("./src/services/ai.service");


connectToDB();
// generateIneterviewReport("resume", "jobDescription", "selfDescription");
//invokeGemini(); // Commented out to prevent hitting the Gemini API rate limit on every server restart

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`The app is running on port ${PORT}`)
})