const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Adaptador para Gemini API
 * Encapsula la interacción con la API de Gemini
 */
class GeminiAdapter {
  constructor(apiKey, modelName = 'gemini-1.5-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Extrae texto e información estructurada de una imagen/PDF
   */
  async extractFromDocument(fileBuffer, mimeType, prompt) {
    const imagePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType,
      },
    };

    const result = await this.model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  }

  /**
   * Procesa texto con un prompt
   */
  async processText(text, prompt) {
    const result = await this.model.generateContent(`${prompt}\n\n${text}`);
    const response = await result.response;
    return response.text();
  }

  /**
   * Extrae JSON estructurado de un documento
   */
  async extractJSON(fileBuffer, mimeType, schema) {
    const prompt = `Extrae la información de este documento en formato JSON siguiendo este esquema:
${JSON.stringify(schema, null, 2)}

Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional ni markdown.`;

    const responseText = await this.extractFromDocument(fileBuffer, mimeType, prompt);
    
    // Limpiar markdown si existe
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    return JSON.parse(jsonText);
  }
}

module.exports = { GeminiAdapter };
