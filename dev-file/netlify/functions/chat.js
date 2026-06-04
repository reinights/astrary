import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API });

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" },
    });
  }

  const { messages } = await req.json();

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
  });

  return new Response(JSON.stringify(completion), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
};

export const config = { path: "/api/chat" };