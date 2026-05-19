const express = require("express");
const cookieParser = require("cookie-parser")
const app = express();
const cors = require("cors")

app.use(express.json());
app.use(cookieParser())

const allowedOrigins = [
    "https://interview-resume-checker-with-gemin.vercel.app",
    "https://interview-resume-checker-with-gemini.onrender.com",
    "http://localhost:5173"
]

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error(`CORS policy: origin ${origin} not allowed`))
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