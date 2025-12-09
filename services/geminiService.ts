import { GoogleGenAI, Type } from "@google/genai";

// 1. Remove the top-level initialization that causes the crash
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string }); <-- BAD

// Helper to get the AI instance safely
const getAI = () => {
  const key = process.env.API_KEY;
  if (!key) {
    console.warn("Gemini API Key is missing");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
};

export const breakDownTask = async (taskText: string): Promise<string[]> => {
  // 2. Initialize inside the function instead
  const ai = getAI();
  if (!ai) return [];

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
    // 3. Initialize inside the function here too
    const ai = getAI();
    if (!ai) return [];

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
