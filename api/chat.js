// api/chat.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body; // массив { role, content }
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // Системный промпт – можно расширить или брать из запроса
  const systemPrompt = `You are an educational assistant embedded in a university hackathon project on depression and escitalopram pharmacogenomics (Team Spliceosomes, QazMedicine).
SCOPE: only psychology, mental health, depression, SSRIs, and pharmacogenomics concepts, explained at an educational level.
RULES:
- You are NOT a doctor. Never diagnose, never recommend a specific dose or drug for an individual, never interpret a person's own genotype or symptoms as clinical advice.
- Keep answers concise (2-4 short paragraphs max), clear, and scientifically accurate. Use plain language.
- If asked anything outside psychology / mental health / pharmacogenomics, briefly decline and steer back.
- If a user expresses distress, hopelessness, or thoughts of self-harm: respond with warmth, encourage them to reach out to a trusted person and to local emergency services or a mental-health crisis line right away, and do not attempt to counsel or assess risk yourself.
- You may reference the project's model (CYP2C19 metabolizer types PM/IM/NM/UM, the +5% remission benefit of PGx testing seen in GUIDED) as educational context.`;

  // Собираем полный список сообщений для API
  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...messages
  ];

  try {
    const response = await fetch('https://api.freetheai.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'bbl/gemini-3.5-flash',   // та же модель, что и в gemini.js
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('FreeTheAi chat error:', response.status, errText);
      return res.status(500).json({ error: `FreeTheAi error: ${response.status}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}
