const { GoogleGenAI } = require("@google/genai");
const z = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")
const PDFDocument = require("pdfkit")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
});


// =================================
// ZOD VALIDATION SCHEMA
// =================================

const interviewReportSchema = z.object({

    title: z.string(),

    matchScore: z.number(),

    technicalQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ),

    behavioralQuestions: z.array(
        z.object({
            question: z.string(),
            intention: z.string(),
            answer: z.string()
        })
    ),

    skillGaps: z.array(
        z.object({
            skill: z.string(),
            severity: z.enum([
                "low",
                "medium",
                "high"
            ])
        })
    ),

    preparationPlan: z.array(
        z.object({
            day: z.number(),
            focus: z.string(),
            tasks: z.array(
                z.string()
            )
        })
    )

});


// =================================
// GOOGLE RESPONSE SCHEMA
// =================================

const responseSchema = {

    type: "object",

    required: [
        "title",
        "matchScore",
        "technicalQuestions",
        "behavioralQuestions",
        "skillGaps",
        "preparationPlan"
    ],

    properties: {

        title: {
            type: "string"
        },

        matchScore: {
            type: "number"
        },

        technicalQuestions: {

            type: "array",

            items: {

                type: "object",

                properties: {

                    question: {
                        type: "string"
                    },

                    intention: {
                        type: "string"
                    },

                    answer: {
                        type: "string"
                    }

                },

                required: [
                    "question",
                    "intention",
                    "answer"
                ]

            }

        },

        behavioralQuestions: {

            type: "array",

            items: {

                type: "object",

                properties: {

                    question: {
                        type: "string"
                    },

                    intention: {
                        type: "string"
                    },

                    answer: {
                        type: "string"
                    }

                },

                required: [
                    "question",
                    "intention",
                    "answer"
                ]

            }

        },

        skillGaps: {

            type: "array",

            items: {

                type: "object",

                properties: {

                    skill: {
                        type: "string"
                    },

                    severity: {

                        type: "string",

                        enum: [
                            "low",
                            "medium",
                            "high"
                        ]

                    }

                },

                required: [
                    "skill",
                    "severity"
                ]

            }

        },

        preparationPlan: {

            type: "array",

            items: {

                type: "object",

                properties: {

                    day: {
                        type: "number"
                    },

                    focus: {
                        type: "string"
                    },

                    tasks: {

                        type: "array",

                        items: {
                            type: "string"
                        }

                    }

                },

                required: [
                    "day",
                    "focus",
                    "tasks"
                ]

            }

        }

    }

};


// =================================
// MAIN FUNCTION
// =================================

async function generateInterviewReport({
    resume,
    jobDescription,
    selfDescription
}) {

    const prompt = `
Analyze the candidate profile carefully.

Return ONLY valid JSON.

Rules:

1. title must be the job title.

Examples:
"Frontend Developer"
"React Developer"
"Software Engineer"
"Full Stack Developer"

2. matchScore must be a number.

Correct:
78

Wrong:
"78%"
"78 percent"

3. technicalQuestions:
minimum 5 objects.

4. behavioralQuestions:
minimum 5 objects.

5. skillGaps:
minimum 3 objects.

6. preparationPlan:
minimum 7 objects.

Never return strings inside arrays.
Never return markdown.


Job Description:
${jobDescription}


Resume:
${resume}


Self Description:
${selfDescription}
`;

    try {

        const response =
            await ai.models.generateContent({

                model: "gemini-2.5-flash",

                contents: prompt,

                config: {

                    responseMimeType:
                        "application/json",

                    responseSchema:
                        responseSchema

                }

            });


        // console.log(
        //     "RAW AI RESPONSE:"
        // );

        // console.log(
        //     response.text
        // );


        const raw =
            JSON.parse(
                response.text
            );


        const parsed =
            interviewReportSchema
                .safeParse(raw);


        if (!parsed.success) {

            console.log(
                "ZOD ERROR:"
            );

            console.log(
                parsed.error
            );

            return null;

        }


        return parsed.data;

    }
    catch (error) {

        console.log(
            "AI ERROR:"
        );

        console.log(
            error
        );

        return null;

    }

}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process"
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    })

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generatePdfFromText(textContent) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 40 })
        const chunks = []

        doc.on("data", (chunk) => chunks.push(chunk))
        doc.on("end", () => resolve(Buffer.concat(chunks)))
        doc.on("error", reject)

        const html = textContent
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<br\s*\/?>/gi, "<br>")
            .replace(/<h([1-6])[^>]*>/gi, "<h$1>")
            .replace(/<p[^>]*>/gi, "<p>")
            .replace(/<li[^>]*>/gi, "<li>")
            .replace(/<ul[^>]*>/gi, "<ul>")
            .replace(/<ol[^>]*>/gi, "<ol>")
            .replace(/<[^>]+>/g, (match) => match.toLowerCase())

        const tokens = html.split(/(<\/?.+?>)/g).filter(Boolean)
        let currentTag = null
        let listDepth = 0

        const flushText = (text, options = {}) => {
            if (!text.trim()) return
            const fontSize = options.heading ? 14 - options.heading * 1.5 : 11
            const fontName = options.heading ? "Helvetica-Bold" : "Helvetica"
            doc.font(fontName).fontSize(fontSize)

            if (options.bullet) {
                const indent = 20 * listDepth
                doc.text(`• ${text.trim()}`, {
                    paragraphGap: 2,
                    indent: indent,
                    continued: false,
                    width: 510 - indent
                })
            } else {
                doc.text(text.trim(), {
                    paragraphGap: options.heading ? 6 : 4,
                    lineGap: 2,
                    continued: false,
                    width: 510
                })
            }
        }

        for (const token of tokens) {
            const trimmed = token.trim()
            if (!trimmed) continue

            if (/^<h([1-6])>$/i.test(trimmed)) {
                currentTag = trimmed.toLowerCase()
                continue
            }

            if (/^<\/h([1-6])>$/i.test(trimmed)) {
                currentTag = null
                doc.moveDown(0.3)
                continue
            }

            if (/^<p>$/i.test(trimmed)) {
                currentTag = "p"
                continue
            }

            if (/^<\/p>$/i.test(trimmed)) {
                currentTag = null
                doc.moveDown(0.15)
                continue
            }

            if (/^<ul>$|^<ol>$/i.test(trimmed)) {
                listDepth += 1
                continue
            }

            if (/^<\/ul>$|^<\/ol>$/i.test(trimmed)) {
                listDepth = Math.max(listDepth - 1, 0)
                doc.moveDown(0.1)
                continue
            }

            if (/^<li>$/i.test(trimmed)) {
                currentTag = "li"
                continue
            }

            if (/^<\/li>$/i.test(trimmed)) {
                currentTag = null
                continue
            }

            if (/^<br>$/i.test(trimmed)) {
                doc.moveDown(0.2)
                continue
            }

            if (currentTag && /^h([1-6])$/i.test(currentTag)) {
                const level = Number(currentTag.slice(1))
                flushText(trimmed, { heading: level })
                continue
            }

            if (currentTag === "li") {
                const cleanText = trimmed.replace(/^•+\s*/g, "")
                flushText(cleanText, { bullet: true })
                continue
            }

            const cleanText = trimmed.replace(/^•+\s*/g, "")
            flushText(cleanText)
        }

        doc.end()
    })
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate a professional resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        Output ONLY valid JSON with a single field exactly named "html".
                        The value of "html" must be a complete HTML document string that includes:
                        - <!doctype html>
                        - <html lang="en">
                        - <head> with <meta charset="utf-8"> and <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        - an inline <style> block for resume layout
                        - <body> with semantic sections.

                        Resume requirements:
                        - Use semantic HTML only: header, section, h1, h2, h3, p, ul, li, strong, em, a.
                        - Use <ul> and <li> for bullet lists; do not add manual bullet characters like "•" inside list item text.
                        - Use a clean, modern single-column layout with an inline CSS style block.
                        - Include a header with name, title, contact info, and optional links.
                        - Include sections for Summary, Technical Skills, Experience, Projects, Certifications, and Education.
                        - Use clear section headings and consistent spacing.
                        - Use simple text styling only; no external stylesheets or scripts.
                        - Keep the resume concise and easy to scan in PDF.
                        - Do not return markdown or extra JSON fields.

                        Example style block to follow:
                        <style>
                        body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 24px; background: #fff; }
                        .container { max-width: 800px; margin: 0 auto; }
                        header { margin-bottom: 24px; }
                        header h1 { font-size: 28px; margin: 0; letter-spacing: -0.5px; }
                        header .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
                        .contact { font-size: 12px; color: #555; margin-top: 10px; line-height: 1.6; }
                        .section { margin-top: 22px; }
                        .section h2 { font-size: 16px; margin: 0 0 10px; color: #111; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
                        .section p { margin: 6px 0 0; line-height: 1.5; }
                        ul { margin: 8px 0 0 18px; padding: 0; }
                        li { margin-bottom: 6px; }
                        .skills { display: block; }
                        .skills span { display: inline-block; margin-right: 12px; margin-bottom: 6px; }
                        .job-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #555; }
                        </style>
                    `

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })

    const jsonContent = JSON.parse(response.text)

    if (!jsonContent || typeof jsonContent.html !== "string" || !jsonContent.html.trim()) {
        throw new Error("Invalid PDF HTML content returned from AI service")
    }

    try {
        return await generatePdfFromHtml(jsonContent.html)
    } catch (error) {
        console.error("Puppeteer PDF generation failed, falling back to PDFKit:", error)
        return await generatePdfFromText(jsonContent.html)
    }

}


module.exports = { generateInterviewReport, generateResumePdf }