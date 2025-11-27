import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Prosty health-check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "RAG feedback backend is running" });
});

// Główny endpoint dla Make
app.post("/feedback", async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: "Missing 'transcript' in body" });
    }

    // Opcjonalnie: przycinamy do 2000 znaków
    const trimmedTranscript = transcript.slice(0, 2000);

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions:
        "Jesteś Piotrem, nauczycielem angielskiego. Użyj file_search, żeby wyciągnąć moje przykłady feedbacku. Skopiuj mój ton, błędy które poprawiam na danym poziomie, sposób pisania feedbacku i podział tekstu. Jak robić feedback: 1) Bierzesz pierwsze 2000 znaków z transkrypcji. 2) Nie poprawiasz niczego w samej transkrypcji – musi być w oryginale, łącznie z błędami. 3) Dzielisz ją na kilka akapitów po 300–400 znaków. 4) Pod każdym akapitem wypisujesz kilka przykładów błędów w takiej formie jak w moim podpiętym feedbacku. 5) Nie piszesz żadnych wstępów ani ogólnych komentarzy. Jak mają wyglądać komentarze: 1) Komentarze są po POLSKU. 2) Kopiujesz zdanie z błędem i oznaczasz je ❌, pod nim dajesz poprawną wersję z ✅, a zmienione fragmenty zapisujesz WIELKIMI LITERAMI. 3) Przy każdym błędzie dodajesz krótkie wyjaśnienie (1–4 zdania), dlaczego to błąd + inny przykład poprawnego użycia.",
      input: `Transcript:\n${trimmedTranscript}`,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [process.env.VECTOR_STORE_ID]
        }
      ],
      max_output_tokens: 800
    });

    const feedbackText =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    if (!feedbackText) {
      return res.status(500).json({
        error: "No feedback text returned from OpenAI"
      });
    }

    res.json({ feedback: feedbackText });
  } catch (err) {
    console.error("Error generating feedback:", err?.response?.data || err.message);
    res.status(500).json({
      error: "Failed to generate feedback",
      details: err?.response?.data || err.message
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
