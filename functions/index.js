const functions = require("firebase-functions");
const path = require("path");
const cors = require("cors")({ origin: true });

const { SessionsClient } = require("@google-cloud/dialogflow-cx");

// Load service account
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  __dirname,
  "account-service.json"
);

exports.chatbot = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const userMessage = req.body.message;

      if (!userMessage) {
        return res.status(400).json({ error: "No message provided" });
      }

      const projectId = "ai-humanity-g3";
      const location = "asia-southeast1";
      const agentId = "5e2a12ec-e1e4-4acf-903a-39e97f53393b";
      const sessionId = Math.random().toString(36).substring(7);

      const client = new SessionsClient({
        apiEndpoint: "asia-southeast1-dialogflow.googleapis.com",
      });

      const sessionPath = client.projectLocationAgentSessionPath(
        projectId,
        location,
        agentId,
        sessionId
      );

      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: userMessage,
          },
          languageCode: "en",
        },
      };

      const [response] = await client.detectIntent(request);

      // 🔍 Debug (optional)
      console.log("FULL RESPONSE:", JSON.stringify(response, null, 2));

      const queryResult = response.queryResult;

      let reply = "";
      let chips = [];

      const messages = queryResult?.responseMessages || [];

      for (const msg of messages) {

        // ================= TEXT =================
        if (msg.text?.text?.length) {
          reply = msg.text.text.join(" ");
        }

        // ================= RICH CONTENT =================
        const richContent =
          msg.payload?.fields?.richContent?.listValue?.values;

        if (richContent) {
          for (const row of richContent) {
            const rowValues = row.listValue?.values || [];

            for (const item of rowValues) {
              const struct = item.structValue?.fields;

              if (struct?.type?.stringValue === "chips") {
                const options =
                  struct.options?.listValue?.values || [];

                chips = options.map(opt => {
                  return opt.structValue?.fields?.text?.stringValue;
                }).filter(Boolean);
              }
            }
          }
        }
      }

      return res.json({ reply, chips });

    } catch (error) {
      console.error("ERROR:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});