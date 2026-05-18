const { GoogleGenAI } = require("@google/genai");
const z = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

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
    const browser = await puppeteer.launch()
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

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
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

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}


module.exports = { generateInterviewReport, generateResumePdf }