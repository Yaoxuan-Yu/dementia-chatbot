const functions = require("firebase-functions");
const path = require("path");
const cors = require("cors")({ origin: true });

const { SessionsClient } = require("@google-cloud/dialogflow-cx");

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  __dirname,
  "service-account.json"
);

exports.chatbot = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const userMessage = req.body.message;
      const sessionId = req.body.sessionId || "default-session";

      if (!userMessage && !req.body.event) {
        return res.status(400).json({ error: "No message or event provided" });
      }

      const projectId = "ai-humanity-g3";
      const location = "asia-southeast1";
      const agentId = "5e2a12ec-e1e4-4acf-903a-39e97f53393b";

      const client = new SessionsClient({
        apiEndpoint: "asia-southeast1-dialogflow.googleapis.com",
      });

      const sessionPath = client.projectLocationAgentSessionPath(
        projectId,
        location,
        agentId,
        sessionId
      );

      // Handle TEXT input OR EVENT input (from chips)
      let queryInput;
      if (req.body.event) {
        // Trigger Dialogflow Event (from chip click)
        queryInput = {
          event: {
            event: req.body.event,
            languageCode: "en",
          },
        };
      } else {
        // Regular text message
        queryInput = {
          text: {
            text: userMessage,
          },
          languageCode: "en",
        };
      }

      const request = {
        session: sessionPath,
        queryInput: queryInput,
      };

      const [response] = await client.detectIntent(request);

      const queryResult = response.queryResult;
      let reply = "";
      let chips = [];

      const messages = queryResult?.responseMessages || [];

      for (const msg of messages) {
        if (msg.text?.text?.length) {
          reply = msg.text.text.join(" ");
        }

        // Parse rich content chips (text + event)
        const richContent = msg.payload?.fields?.richContent?.listValue?.values;
        if (richContent) {
          for (const row of richContent) {
            const rowValues = row.listValue?.values || [];
            for (const item of rowValues) {
              const struct = item.structValue?.fields;
              if (struct?.type?.stringValue === "chips") {
                const options = struct.options?.listValue?.values || [];
                // Extract FULL chip data: text + event
                chips = options.map(opt => {
                  const fields = opt.structValue?.fields;
                  return {
                    text: fields?.text?.stringValue,
                    event: fields?.event?.structValue?.fields?.event?.stringValue
                  };
                }).filter(item => item.text);
              }
            }
          }
        }
      }

      return res.json({ reply, chips });

    } catch (error) {
      console.error("Dialogflow API Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});