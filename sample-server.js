import express from "express";
import axios from "axios";
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch, { Headers } from 'node-fetch';

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, PORT } = process.env;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05",systemInstruction: "You are a helpful AI assistant, you understand tamil and tanglish and you will always respond to user only in tamil language., before responding to user verify your response whether it's in tamil" });

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

if (!globalThis.Headers) {
    globalThis.Headers = Headers;
}

app.post("/webhook", async (req, res) => {
    console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));

    const chatHistory = [];


    const modifiedHistory = chatHistory.length === 0 ? "" : chatHistory;

    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || "";

    const chat = model.startChat({
        history: modifiedHistory
    });

    try {
        const result = await chat.sendMessage(msg); // Corrected this line
        const response = await result.response;
        const text = response.candidates[0].content.parts[0].text; // Accessing the text directly from the response candidates
        console.log("Response:", text);

        const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]; // Added this line to define 'message'

        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
            headers: {
                Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            },
            data: {
                messaging_product: "whatsapp",
                to: message.from,
                text: { body: "இயலி: " + text },
                context: {
                    message_id: message.id,
                },
            },
        });

        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
            headers: {
                Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            },
            data: {
                messaging_product: "whatsapp",
                status: "read",
                message_id: message.id,
            },
        });
    } catch (error) {
        console.error("Error:", error);
    }

    res.sendStatus(200);
});

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
        console.log("Webhook verified successfully!");
    } else {
        res.sendStatus(403);
    }
});

app.get("/", (req, res) => {
    res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}`);
});