
const { GoogleGenAI } = require("@google/genai");

function createFallbackReminder(invoice) {
  return `Subject: Payment follow-up — Invoice ${invoice.id}

Dear ${invoice.client} team,

I hope you are doing well.

I am writing to follow up on invoice ${invoice.id} for ${invoice.project}, amounting to INR ${invoice.amount.toLocaleString("en-IN")}, due on ${invoice.dueDate}.

Could you please let me know the expected payment date? If payment has already been made, kindly disregard this reminder and share the payment confirmation when convenient.

Thank you for your time and support.

Best regards,
Your Accounts Team`;
}

async function generateReminder(invoice) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      reminder: createFallbackReminder(invoice),
      source: "template",
      note: "Gemini is not configured. This is a template, not AI-generated text.",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Write a concise, professional payment reminder email for a freelancer.

Invoice ID: ${invoice.id}
Client: ${invoice.client}
Project: ${invoice.project}
Amount: INR ${invoice.amount}
Due date: ${invoice.dueDate}
Status: ${invoice.status}
Days overdue: ${invoice.daysOverdue}

Include a subject and email body. Be polite and non-threatening.
Do not invent previous conversations, penalties, or payment terms.
Ask the client to confirm the expected payment date.
Return only the email draft.
`;

    const response = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    });

    const text = response.output_text;

    if (!text || !text.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      reminder: text.trim(),
      source: "gemini",
      note: "AI-generated draft. Review before sending.",
    };
  } catch (error) {
    console.error("Gemini unavailable; using template fallback:", error.message);

    return {
      reminder: createFallbackReminder(invoice),
      source: "template",
      note: "Gemini is temporarily unavailable. This is a template, not AI-generated text.",
    };
  }
}

module.exports = { generateReminder };
