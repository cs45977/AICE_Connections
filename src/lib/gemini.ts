import { toast } from "sonner";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini on the client
// AI Studio injects GEMINI_API_KEY into the environment
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is missing from process.env");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

async function callGemini(model: string, prompt: string, config?: any) {
  if (!apiKey) {
    const error = new Error("Gemini API Key is missing. Please check your application environment settings.");
    toast.error("AI Configuration Error: Missing API Key.");
    throw error;
  }
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config
    });
    
    if (!response || !response.text) {
      throw new Error("Empty response received from AI model.");
    }

    return response;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw error;
  }
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
  
  At the end, state that contact emails should be verified independently.`,
  generateCompanyIntelligence: `Analyze {{companyName}} ({{companyUrl}}) and provide a high-level strategic intelligence report.
  Focus on:
  1. Core Business Model & Revenue Drivers
  2. Recent Growth Signals, Funding, or Major Strategic Shifts
  3. Key Technology Stack or Operational Challenges (Inferred or Researched)
  4. Strategic Alignment: Why this company is a prime target for {{personaRole}}.
  
  Format the output in a clean, professional executive summary style with clear headings.`
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

export interface PersonaContext {
  agentName?: string;
  agentRole?: string;
  agentEmail?: string;
}

export async function researchContact(contact: { name: string, email: string, role: string, company: string }, promptOverride?: string, persona?: PersonaContext) {
  const template = promptOverride || await getPromptTemplate("researchContact");
  
  let contextInfo = "";
  if (persona) {
    contextInfo = `\nContext: You are ${persona.agentName || "an AI Assistant"} working as ${persona.agentRole || "a Technical Researcher"}. ${persona.agentEmail ? `Your email for business context is: ${persona.agentEmail}` : ""}\n`;
  }

  const prompt = contextInfo + replaceVariables(template, {
    name: contact.name,
    email: contact.email,
    role: contact.role,
    company: contact.company || "their company"
  });

  try {
    const response = await callGemini("gemini-3-flash-preview", prompt, {
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    });
    return response.text;
  } catch (error: any) {
    const errData = String(error);
    const isForbidden = errData.toLowerCase().includes("forbidden") || errData.toLowerCase().includes("403");
    
    if (isForbidden && window.location.hostname !== "localhost") {
       toast.error("Agent Connection Blocked: Your domain might not be authorized or Grounding is restricted. Falling back to non-grounded search.");
    }

    const isRateLimit = errData.includes("429") || 
                        errData.includes("RESOURCE_EXHAUSTED") || 
                        errData.includes("quota") ||
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
        const retryResponse = await callGemini("gemini-3-flash-preview", prompt);
        return retryResponse.text;
      } catch (retryErr) {
        return "Search failed due to billing limits. Please check your Google Gemini API billing.";
      }
    }
    throw error;
  }
}

export async function generateEmail(subject: string, researchSummary: string, contact: { name: string, role: string, company: string }, promptOverride?: string, persona?: PersonaContext) {
  const template = promptOverride || await getPromptTemplate("generateEmail");
  
  let contextInfo = "";
  if (persona) {
    contextInfo = `\nContext: You are writing this email as ${persona.agentName || "an AI Assistant"}. Your role is ${persona.agentRole || "a Sales Representative"}. Your signature should reflect this. ${persona.agentEmail ? `Reply-to/Your Email: ${persona.agentEmail}` : ""}\n`;
  }

  const prompt = contextInfo + replaceVariables(template, {
    subject,
    name: contact.name,
    role: contact.role,
    company: contact.company || "their company",
    researchSummary
  });

  try {
    const response = await callGemini("gemini-3-flash-preview", prompt, {
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    });

    return response.text;
  } catch (error: any) {
    const errData = String(error);
    const isForbidden = errData.toLowerCase().includes("forbidden") || errData.toLowerCase().includes("403");
    
    if (isForbidden && window.location.hostname !== "localhost") {
       toast.error("Grounding restricted on this domain. Falling back to non-grounded generation.");
       try {
         const retryResponse = await callGemini("gemini-3-flash-preview", prompt);
         return retryResponse.text;
       } catch (retryErr) {
         throw retryErr;
       }
    }

    const isRateLimit = errData.includes("429") || 
                        errData.includes("RESOURCE_EXHAUSTED") || 
                        errData.includes("quota") ||
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
        const retryResponse = await callGemini("gemini-3-flash-preview", prompt);
        return retryResponse.text;
      } catch (retryErr) {
        return "Email generation failed due to billing limits. Please check your Google Gemini API billing.";
      }
    }
    throw error;
  }
}

export async function generateSuggestedGoals(contact: { name: string, role: string, company: string }, researchSummary: string) {
  const prompt = `Based on the following research summary for ${contact.name} (${contact.role} at ${contact.company}), provide 3-5 concise, highly effective outreach goals or themes for a sales personalized email (e.g., "Discuss recent cloud migration strategy", "Congratulate on series B and offer infrastructure scaling audit").
  
  Research:
  ${researchSummary}
  
  Provide exactly a JSON array of strings.`;

  try {
    const schema = {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    };
    const response = await callGemini("gemini-3-flash-preview", prompt, {
      responseMimeType: "application/json",
      responseSchema: schema
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Failed to generate suggested goals", error);
    return [
      "Schedule technical overview",
      "Discuss product partnership",
      "Executive introduction"
    ];
  }
}

export async function generateDiscoveryQuestions(company: { name: string, url: string, linkedin?: string }, persona?: PersonaContext) {
  const template = await getPromptTemplate("generateDiscoveryQuestions");
  
  let contextInfo = "";
  if (persona) {
    contextInfo = `\nContext: You are ${persona.agentName || "an AI Assistant"} working as ${persona.agentRole || "a Technical Researcher"}. Your goal is to represent this identity in your questions.\n`;
  }

  const prompt = contextInfo + replaceVariables(template, {
    companyName: company.name,
    companyUrl: company.url
  });

  const response = await callGemini("gemini-3-flash-preview", prompt);
  return response.text;
}

export async function searchProspects(company: { name: string, url: string }, searchCriteria: string, persona?: PersonaContext) {
  const template = await getPromptTemplate("searchProspects");

  let contextInfo = "";
  if (persona) {
    contextInfo = `\nContext: You are ${persona.agentName || "an AI Assistant"} working as ${persona.agentRole || "a Technical Researcher"}. You are seeking prospects that would be ideal targets for your role and company mission.\n`;
  }

  const prompt = contextInfo + replaceVariables(template, {
    companyName: company.name,
    companyUrl: company.url,
    criteria: searchCriteria
  });

  const schema = {
    type: Type.OBJECT,
    properties: {
      prospects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            department: { type: Type.STRING },
            linkedin: { type: Type.STRING, nullable: true },
            source: { type: Type.STRING, nullable: true },
            insight: { type: Type.STRING }
          },
          required: ["name", "title", "department", "insight"]
        }
      }
    },
    required: ["prospects"]
  };

  try {
    const response = await callGemini("gemini-3-flash-preview", prompt, {
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
      const response = await callGemini("gemini-3-flash-preview", prompt, {
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

export async function generateCompanyIntelligence(company: { name: string, url: string }, persona?: PersonaContext) {
  const template = await getPromptTemplate("generateCompanyIntelligence" as any);
  
  let contextInfo = "";
  if (persona) {
    contextInfo = `\nContext: You are ${persona.agentName || "an AI Assistant"} working as ${persona.agentRole || "a Technical Researcher"}. You are generating this report for strategic alignment.\n`;
  }

  const prompt = contextInfo + replaceVariables(template, {
    companyName: company.name,
    companyUrl: company.url,
    personaRole: persona?.agentRole || "a strategic advisor"
  });

  try {
    const response = await callGemini("gemini-3-flash-preview", prompt, {
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    });
    return response.text;
  } catch (error) {
    console.error("Intelligence report failed with grounding, retrying without...", error);
    const retryResponse = await callGemini("gemini-3-flash-preview", prompt);
    return retryResponse.text;
  }
}
