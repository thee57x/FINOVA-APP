import { GoogleGenAI } from "@google/genai";
import { CATEGORIES } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function categorizeExpense(description: string, amount: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Categorize this expense: "${description}" for amount ${amount} NGN. 
      Choose from these categories: ${CATEGORIES.join(', ')}. 
      Return ONLY the category name.`,
    });
    const category = response.text?.trim();
    return CATEGORIES.includes(category || '') ? category : 'Others';
  } catch (error) {
    console.error("Gemini Categorization Error:", error);
    return 'Others';
  }
}

export async function getBudgetAdvice(expenses: any[], budgets: any[], currencyCode: string, currencySymbol: string) {
  try {
    const prompt = `Based on these monthly expenses: ${JSON.stringify(expenses)} 
    and these budget limits: ${JSON.stringify(budgets)}, 
    provide 3 concise, actionable tips to save money and stay within budget. 
    The user's preferred currency is ${currencyCode} (${currencySymbol}). 
    Format as a simple Markdown list. Do NOT use any emojis in your response.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No advice available at this time.";
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    return "Unable to provide budget advice right now.";
  }
}

export async function getChatResponse(messages: { role: 'user' | 'assistant', content: string }[], expenses: any[], budgets: any[], currencyCode: string, currencySymbol: string) {
  try {
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: `You are Finova, a helpful financial advisor. 
        The user's current monthly expenses are: ${JSON.stringify(expenses)}. 
        Their budget limits are: ${JSON.stringify(budgets)}. 
        Their preferred currency is ${currencyCode} (${currencySymbol}). 
        Provide concise, actionable financial advice. 
        Be conversational and helpful. 
        Format your responses in Markdown. 
        Do NOT use any emojis in your response.`,
      },
    });
    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting right now. Please try again later.";
  }
}
