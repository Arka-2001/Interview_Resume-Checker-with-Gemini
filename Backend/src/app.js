const express = require("express");
const cookieParser = require("cookie-parser")
const app = express();
const cors = require("cors")

const allowedOrigins = [
    process.env.CLIENT_URL || "https://interview-resume-checker-with-gemin.vercel.app",
    "http://localhost:5173"
]

app.use(express.json());
app.use(cookieParser())
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error("Not allowed by CORS"))
        }
    },
    credentials: true
}))

const authRouter = require("./routes/auth.routes");
const interviewRouter = require("./routes/interview.routes");
/* using all the routes here */

app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);


// app.get("/", (req, res) => {
//     res.send("Hello World!");
// });

module.exports = app;