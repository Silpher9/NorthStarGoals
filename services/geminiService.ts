
import { GoogleGenAI, Type } from "@google/genai";

// Initialize directly with process.env.API_KEY per guidelines.
// "The API key must be obtained exclusively from the environment variable process.env.API_KEY"
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const breakDownTask = async (taskText: string): Promise<string[]> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found");
    return [];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Break down the following task into 3 to 5 smaller, actionable sub-tasks. Task: "${taskText}". Keep them concise.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    // Parse JSON and extract strings. Expecting array of objects or strings depending on model behavior,
    // but we requested schema. Let's handle generic array output safely.
    let parsed: any;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        return [];
    }

    if (Array.isArray(parsed)) {
        return parsed.map((item: any): string => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && item.task) return String(item.task);
            return JSON.stringify(item);
        });
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};

export const generateTasksFromNote = async (noteContent: string): Promise<string[]> => {
    if (!process.env.API_KEY) {
        console.warn("No API Key found");
        return [];
    }

    // Strip HTML tags for cleaner processing
    const cleanText = noteContent.replace(/<[^>]*>?/gm, '');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following note and extract a list of actionable tasks. Return them as a simple list of strings. Note Content: "${cleanText}"`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            task: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];

        let parsed: any;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return [];
        }

        if (Array.isArray(parsed)) {
            return parsed.map((item: any): string => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && item.task) return String(item.task);
                return JSON.stringify(item);
            });
        }
        return [];
    } catch (error) {
        console.error("Gemini API Error (Note to Task):", error);
        return [];
    }
};
