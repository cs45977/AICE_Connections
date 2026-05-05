import { toast } from "sonner";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

async function callGeminiProxy(contents: string, config?: any) {
  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      config,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const err = new Error(errorData.error || "Gemini request failed");
    (err as any).type = errorData.type;
    (err as any).status = response.status;
    throw err;
  }

  return await response.json();
}

const DEFAULT_PROMPTS = {
  researchContact: `Perform research on this contact and their company to find relevant sales personalization insights.
  Contact Name: {{name}}
  Email: {{email}}
  Role: {{role}}
  Company: {{company}}
  
  Provide a list of 5 key insights, recent company news, or professional highlights that a sales person could use to personalize an outreach email.
  Format the response as bullet points.`,
  generateEmail: `You are an expert Google Customer Engineer. Your goal is to write a highly personalized, consultative, and value-driven sales outreach email.
  
  Outreach Subject/Goal: {{subject}}
  Contact Name: {{name}}
  Contact Role: {{role}}
  Contact Company: {{company}}
  
  Research Insights:
  {{researchSummary}}
  
  Write the email draft. Use a professional yet conversational tone. Incorporate at least 2 specific research insights.
  
  Structure:
  1. Professional Greeting
  2. Personalized Hook (based on research)
  3. Value Prop (connected to their role/company)
  4. Soft Call to Action
  5. Professional Closing`,
  generateDiscoveryQuestions: `You are a sales discovery agent. A user wants to find prospects at {{companyName}} ({{companyUrl}}).
  Your goal is to ask 2-3 specific questions to help narrow down what kind of prospects they are looking for (e.g. "Are you looking for decision makers in IT or Marketing?", "Should they be based in a specific region?").
  Provide the output as a list of questions. Keep it brief and professional.`,
  searchProspects: `Find potential prospect names and their job titles for the company {{companyName}} ({{companyUrl}}) based on these criteria: {{criteria}}.
  You MUST search the web for real people if possible. 
  Provide a list of 5-8 potential prospects.
  
  Format the output as a JSON list of objects. Each object should have:
  - name: Full Name
  - title: Job Title
  - department: Likely focus/department
  - linkedin: A professional LinkedIn URL if found, or null
  - source: A URL to the source of this information or the company website profile if found, or null
  - insight: A brief 1-sentence insight on why they match the criteria
  
  At the end, state that contact emails should be verified independently.`
};

async function getPromptTemplate(id: keyof typeof DEFAULT_PROMPTS): Promise<string> {
  try {
    const promptRef = doc(db, "prompts", id);
    const snap = await getDoc(promptRef);
    if (snap.exists()) {
      return snap.data().template;
    }
  } catch (error) {
    console.error("Error fetching dynamic prompt:", error);
  }
  return DEFAULT_PROMPTS[id];
}

function replaceVariables(template: string, variables: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || "");
  }
  return result;
}

export async function researchContact(contact: { name: string, email: string, role: string, company: string }) {
  const template = await getPromptTemplate("researchContact");
  const prompt = replaceVariables(template, {
    name: contact.name,
    email: contact.email,
    role: contact.role,
    company: contact.company
  });

  try {
    const response = await callGeminiProxy(prompt, {
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    });
    return response.text;
  } catch (error: any) {
    const errData = String(error);
    const isForbidden = error.type === "FORBIDDEN" || errData.toLowerCase().includes("forbidden") || errData.toLowerCase().includes("403");
    
    if (isForbidden && window.location.hostname !== "localhost") {
       toast.error("Agent Connection Blocked: Your domain might not be authorized or Grounding is restricted. Falling back to non-grounded search.");
    }

    const isRateLimit = error.type === "QUOTA_EXCEEDED" ||
                        errData.includes("429") || 
                        errData.includes("RESOURCE_EXHAUSTED") || 
                        errData.includes("prepayment credits") ||
                        error?.status === 429;
                         
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
        const retryResponse = await callGeminiProxy(prompt);
        return retryResponse.text;
      } catch (retryErr) {
        return "Search failed due to billing limits. Please check your Google Gemini API billing.";
      }
    }
    throw error;
  }
}

export async function generateEmail(subject: string, researchSummary: string, contact: { name: string, role: string, company: string }) {
  const template = await getPromptTemplate("generateEmail");
  const prompt = replaceVariables(template, {
    subject,
    name: contact.name,
    role: contact.role,
    company: contact.company,
    researchSummary
  });

  try {
    const response = await callGeminiProxy(prompt, {
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    });

    return response.text;
  } catch (error: any) {
    const errData = String(error);
    const isRateLimit = error.type === "QUOTA_EXCEEDED" ||
                        errData.includes("429") || 
                        errData.includes("RESOURCE_EXHAUSTED") || 
                        errData.includes("prepayment credits") ||
                        error?.status === 429;
                        
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
        const retryResponse = await callGeminiProxy(prompt);
        return retryResponse.text;
      } catch (retryErr) {
        return "Email generation failed due to billing limits. Please check your Google Gemini API billing.";
      }
    }
    throw error;
  }
}

export async function generateDiscoveryQuestions(company: { name: string, url: string, linkedin?: string }) {
  const template = await getPromptTemplate("generateDiscoveryQuestions");
  const prompt = replaceVariables(template, {
    companyName: company.name,
    companyUrl: company.url
  });

  const response = await callGeminiProxy(prompt);
  return response.text;
}

export async function searchProspects(company: { name: string, url: string }, searchCriteria: string) {
  const template = await getPromptTemplate("searchProspects");
  const prompt = replaceVariables(template, {
    companyName: company.name,
    companyUrl: company.url,
    criteria: searchCriteria
  });

  const schema = {
    type: "object",
    properties: {
      prospects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            department: { type: "string" },
            linkedin: { type: "string", nullable: true },
            source: { type: "string", nullable: true },
            insight: { type: "string" }
          },
          required: ["name", "title", "department", "insight"]
        }
      }
    },
    required: ["prospects"]
  };

  try {
    const response = await callGeminiProxy(prompt, {
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true },
      responseMimeType: "application/json",
      responseSchema: schema
    });
    const parsed = JSON.parse(response.text);
    return Array.isArray(parsed.prospects) ? parsed.prospects : [];
  } catch (error: any) {
    const errData = String(error);
    if (errData.toLowerCase().includes("forbidden") && window.location.hostname !== "localhost") {
       console.warn("Prospect search grounded tool was forbidden on this origin:", window.location.hostname);
    }
    
    try {
      const response = await callGeminiProxy(prompt, {
        responseMimeType: "application/json",
        responseSchema: schema
      });
      const parsed = JSON.parse(response.text);
      return Array.isArray(parsed.prospects) ? parsed.prospects : [];
    } catch (innerError) {
      console.error("Gemini parse error:", innerError);
      return [];
    }
  }
}
