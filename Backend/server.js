require("dotenv").config();

const connectToDB = require("./src/config/database");
const app = require("./src/app");
const { generateIneterviewReport } = require("./src/services/ai.service");


connectToDB();
// generateIneterviewReport("resume", "jobDescription", "selfDescription");
//invokeGemini(); // Commented out to prevent hitting the Gemini API rate limit on every server restart

app.listen(3000, () => {
    console.log("The app is running on 3000 port")
})