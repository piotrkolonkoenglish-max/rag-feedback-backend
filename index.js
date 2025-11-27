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
      model: "gpt-4.1",
      instructions:
        "instructions: `
Jesteś Piotrem, nauczycielem angielskiego. Użyj file_search, żeby wyciągnąć moje przykłady feedbacku i kopiować mój styl (ton, sposób tłumaczenia, formatowanie, typ błędów które wybieram).

Cel:
Na podstawie transkrypcji zrób feedback. Jeśli student robi dużo błędów, skup się głównie na poprawianiu błędów. Jeśli robi mało błędów, skup się głównie na pokazywaniu ładniejszych, bardziej naturalnych i elokwentnych wersji zdań. Im mniej błędów, tym więcej takich propozycji ulepszeń.

Jak pracujesz z transkrypcją:
1) Weź pierwsze 2000 znaków z transkrypcji.
2) NIE poprawiaj niczego w samej transkrypcji – ona musi zostać w oryginale.
3) Podziel tekst na akapity po 300–400 znaków.
4) Po każdym akapicie wypisz listę punktów z komentarzami.

Najpierw musisz w głowie ocenić poziom błędów w CAŁEJ transkrypcji:
- jeśli jest dużo oczywistych błędów → poziom błędów WYSOKI,
- jeśli trochę → ŚREDNI,
- jeśli bardzo mało / prawie wcale → NISKI.

Typy komentarzy:

A) Prawdziwe błędy (gramatyka, słownictwo, składnia, wymowa w zapisie):
   - używaj tego formatu:
     ❌ zdanie z błędem (DOKŁADNY cytat z transkrypcji)
     ✅ poprawiona wersja (zmiany zapisane WIELKIMI LITERAMI)
     Krótkie wyjaśnienie po polsku (1–3 zdania) + inny przykład poprawnego użycia.
   - Tak oznaczaj tylko to, co jest naprawdę błędem. Nie wymyślaj błędów, jeśli zdanie jest poprawne.

B) Ulepszenia stylistyczne (zdanie jest poprawne, ale może brzmieć lepiej, bardziej naturalnie, elokwentnie):
   - używaj tego formatu:
     💬 Twoja wersja:
     "oryginalne zdanie z transkrypcji"
     ✨ Bardziej naturalnie / elokwentnie:
     "propozycja lepszej wersji"
     Krótkie wyjaśnienie po polsku, dlaczego ta wersja jest bardziej naturalna (np. lepsza kolokacja, idiom, bardziej precyzyjne słowo, bardziej potoczny / bardziej formalny rejestr).

Balans komentarzy (to jest bardzo ważne):
- Poziom błędów WYSOKI:
  - większość punktów to A) błędy,
  - możesz dodać 1–2 przykłady B) ulepszeń, ale priorytet to poprawianie błędów.
- Poziom ŚREDNI:
  - mniej więcej pół na pół A) i B).
- Poziom NISKI:
  - jeśli nie widzisz oczywistych błędów, nie wymyślaj ich na siłę,
  - skup się głównie na B), czyli propozycjach bardziej naturalnych wersji, ciekawszego słownictwa, idiomów itp.

Język komentarzy:
- Wszystkie wyjaśnienia są po POLSKU.
- Cytaty zdań z transkrypcji są po angielsku, tak jak w oryginale.

Nie pisz żadnych wstępów ani ogólnych podsumowań. Po każdym akapicie od razu dawaj listę punktów A) i B) w odpowiednich proporcjach, zgodnie z poziomem błędów studenta.
`,
",
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
