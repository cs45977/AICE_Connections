import { GoogleGenAI, Type } from "@google/genai";
import { toast } from "sonner";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function researchContact(contact: { name: string, email: string, role: string, company: string }) {
  const prompt = `Perform research on this contact and their company to find relevant sales personalization insights.
  Contact Name: ${contact.name}
  Email: ${contact.email}
  Role: ${contact.role}
  Company: ${contact.company}
  
  Provide a list of 5 key insights, recent company news, or professional highlights that a sales person could use to personalize an outreach email.
  Format the response as bullet points.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} } as any],
        toolConfig: { includeServerSideToolInvocations: true } as any
      }
    });
    return response.text;
  } catch (error: any) {
    const errData = typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error);
    const isRateLimit = errData.includes("429") || 
                        errData.includes("RESOURCE_EXHAUSTED") || 
                        errData.includes("prepayment credits") ||
                        error?.status === 429 || 
                        error?.code === 429;
                        
    if (isRateLimit) {
      toast.warning(
        "Diminished Result: Grounding limits reached. Check billing.",
        {
          action: {
            label: "Learn More",
            onClick: () => window.open("https://ai.google.dev/gemini-api/docs/billing#prepay", "_blank")
          },
          duration: 10000,
        }
      );
      try {
        const retryResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        return retryResponse.text;
      } catch (retryErr) {
        return "Search failed due to billing limits. Please check your Google Gemini API billing.";
      }
    }
    throw error;
  }
}

export async function generateEmail(subject: string, researchSummary: string, contact: { name: string, role: string, company: string }) {
  const prompt = `You are an expert Google Customer Engineer. Your goal is to write a highly personalized, consultative, and value-driven sales outreach email.
  
  Outreach Subject/Goal: ${subject}
  Contact Name: ${contact.name}
  Contact Role: ${contact.role}
  Contact Company: ${contact.company}
  
  Research Insights:
  ${researchSummary}
  
  Write the email draft. Use a professional yet conversational tone. Incorporate at least 2 specific research insights.
  
  Structure:
  1. Professional Greeting
  2. Personalized Hook (based on research)
  3. Value Prop (connected to their role/company)
  4. Soft Call to Action
  5. Professional Closing`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} } as any],
        toolConfig: { includeServerSideToolInvocations: true } as any
      }
    });

    return response.text;
  } catch (error: any) {
    const errData = typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error);
    const isRateLimit = errData.includes("429") || 
                        errData.includes("RESOURCE_EXHAUSTED") || 
                        errData.includes("prepayment credits") ||
                        error?.status === 429 || 
                        error?.code === 429;
                        
    if (isRateLimit) {
      toast.warning(
        "Diminished Result: Grounding limits reached. Check billing.",
        {
          action: {
            label: "Learn More",
            onClick: () => window.open("https://ai.google.dev/gemini-api/docs/billing#prepay", "_blank")
          },
          duration: 10000,
        }
      );
      try {
        const retryResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        return retryResponse.text;
      } catch (retryErr) {
        return "Email generation failed due to billing limits. Please check your Google Gemini API billing.";
      }
    }
    throw error;
  }
}
