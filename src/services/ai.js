 import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Parses conversational history to extract slot-filling parameters for clinic bookings.
 * @param {string} conversationHistory - The formatted context tracking user and assistant turns.
 */
export async function understandPatient(conversationHistory) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: {
        type: "json_object"
      },
      messages: [
       // ... inside services/ai.js messages array
{
  role: "system",
  content: `
You are a medical appointment information extraction engine analyzing a conversation.
Your job is to look at the dialogue history and extract or update the state of the following entity slots.

IMPORTANT:
Return ONLY valid JSON.
Never return explanations, markdown, or extra keys.

The JSON MUST ALWAYS have EXACTLY these keys:
{
  "intent": "",
  "specialization": "",
  "city": "",
  "doctorName": "",
  "date": "",
  "time": ""
}

// ... inside services/ai.js system prompt rules

Rules:
1. Missing or unmentioned values = empty string ("").
2. Retain fields established earlier in the conversation UNLESS the user clearly pivots, mentions a new symptom, or asks for a different type of doctor/specialization.
3. 🚨 OVERWRITE & PIVOT RULE: 
   - If the user changes from one specialty to another (e.g., "neurologist" to "cardiologist"), clear out the old specialty.
   - If the user shifts to searching for a specific doctor by name (e.g., "Book with Dr Sameer Khan"), change the "doctorName" slot and CLEAR the "specialization" slot entirely, setting it to "". Let the backend find that doctor by name rather than forcing an old specialty on them.
4. Convert symptoms into a standard medical specialization (e.g., "toothache" -> "dentist", "chest pain" -> "cardiologist").
5. Format "date" naturally but clearly for extraction (e.g., "2026-06-16", "Monday", "Tomorrow").
6. Format "time" clearly (e.g., "10:00 AM", "3:30 PM").
7. If the user explicitly mentions a doctor by name, prioritize that over any previously mentioned specialization. Clear the specialization slot to "" in this case to avoid conflicts.
8. specialization must contain ONE value only. Do not return lists.
9. PRIORITIZE THE LATEST USER UTTERANCE: If the very last line of the conversation history contains an explicit symptom (e.g., "pain in my chest", "cough"), you MUST translate this immediately into a specialization (e.g., "cardiologist") and clear out any old incompatible "doctorName" if that doctor was not explicitly mentioned in this turn.
10. If the user switches focus to a symptom, don't let historical context carry over an irrelevant doctor name from 3 turns ago.
11. Format dates as YYYY-MM-DD (or relative terms like "Tomorrow") and times clearly like "03:00 PM".

`
},
        {
          role: "user",
          content: `Analyze this booking conversation and update the parameters:\n\n${conversationHistory}`
        }
      ]
    });

    const data = JSON.parse(completion.choices[0].message.content);

    if (typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid AI response structure");
    }

    return {
      intent: data.intent || "",
      specialization: data.specialization || "",
      city: data.city || "",
      doctorName: data.doctorName || "",
      date: data.date || "",
      time: data.time || ""
    };
  } catch (error) {
    console.error("❌ Groq AI processing failure:", error);
    return { intent: "", specialization: "", city: "", doctorName: "", date: "", time: "" };
  }
}