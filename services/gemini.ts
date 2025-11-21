import { GoogleGenAI, Type } from "@google/genai";
import { ProductContext, Persona, EvaluationMetrics, ChatMessage } from "../types";

// Use a factory function to ensure we grab the current environment variable
// when the client is needed, avoiding initialization issues.
export const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractProductInfo = async (url: string, manualText: string): Promise<ProductContext> => {
  const ai = getClient();
  const prompt = `
    Jeg trenger informasjon om bedriften eller produktet fra denne URL-en: ${url}.
    
    Hvis du ikke kan besøke URL-en, bruk følgende tilleggstekst fra brukeren til å forstå hva de selger:
    "${manualText}"

    Analyser dette og returner et JSON-objekt med:
    - companyName: Navn på bedriften/produktet
    - description: Kort beskrivelse av hva de gjør (maks 2 setninger)
    - sellingPoints: Liste med 3-5 unike salgsargumenter (USPs)

    Svar KUN med JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            companyName: { type: Type.STRING },
            description: { type: Type.STRING },
            sellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['companyName', 'description', 'sellingPoints']
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as ProductContext;
    }
    throw new Error("No response from AI");
  } catch (error) {
    console.error("Error extracting info:", error);
    // Fallback mock
    return {
      url,
      companyName: "Ukjent Bedrift",
      description: "Kunne ikke hente info automatisk. Bruker standard oppsett.",
      sellingPoints: ["Kvalitet", "Service", "Innovasjon"]
    };
  }
};

export const generatePersonas = async (product: ProductContext): Promise<Persona[]> => {
  const ai = getClient();
  const prompt = `
    Basert på følgende produkt/bedrift:
    Navn: ${product.companyName}
    Beskrivelse: ${product.description}
    Salgsargumenter: ${product.sellingPoints.join(', ')}

    Generer 4 ulike "sales personas" som en selger kan trene på å ringe til.
    Varier vanskelighetsgrad (difficulty) fra 1 til 5.
    
    Returner en liste i JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              title: { type: Type.STRING },
              companySize: { type: Type.STRING },
              industry: { type: Type.STRING },
              motivation: { type: Type.STRING },
              painPoints: { type: Type.STRING },
              communicationStyle: { type: Type.STRING },
              difficulty: { type: Type.INTEGER },
              avatarColor: { type: Type.STRING, description: "A tailwind color class like 'bg-red-500' or 'bg-blue-500'" }
            },
            required: ['id', 'name', 'title', 'companySize', 'industry', 'motivation', 'painPoints', 'communicationStyle', 'difficulty', 'avatarColor']
          }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as Persona[];
    }
    return [];
  } catch (error) {
    console.error("Error generating personas:", error);
    return [];
  }
};

export const evaluateSession = async (transcript: ChatMessage[], product: ProductContext, persona: Persona): Promise<EvaluationMetrics> => {
  const ai = getClient();
  const transcriptText = transcript.map(m => `${m.role}: ${m.text}`).join('\n');
  
  const prompt = `
    Evaluer denne salgssamtalen.
    
    Selger (User) prøver å selge ${product.companyName} til ${persona.name} (${persona.title}).
    
    Transkripsjon:
    ${transcriptText}

    Gi en score fra 0-100 på hver kategori og gi konstruktiv tilbakemelding.
    Svar på norsk.
  `;

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            openingScore: { type: Type.INTEGER },
            discoveryScore: { type: Type.INTEGER },
            pitchScore: { type: Type.INTEGER },
            objectionHandlingScore: { type: Type.INTEGER },
            closingScore: { type: Type.INTEGER },
            totalScore: { type: Type.INTEGER },
            goodPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as EvaluationMetrics;
    }
    throw new Error("Evaluation failed");
  } catch (error) {
    console.error(error);
    return {
        openingScore: 0, discoveryScore: 0, pitchScore: 0, objectionHandlingScore: 0, closingScore: 0, totalScore: 0,
        goodPoints: ["Kunne ikke evaluere"], improvementPoints: [], nextSteps: []
    };
  }
};