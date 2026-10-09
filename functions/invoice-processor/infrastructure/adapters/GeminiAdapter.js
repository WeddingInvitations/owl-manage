const { GoogleGenerativeAI } = require('@google/generative-ai');

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME_TYPE = 'application/msword';

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

    let responseText;
    if (mimeType === DOCX_MIME_TYPE) {
      // DOCX is uncommon: defer loading its ZIP/XML dependencies so Cloud Functions
      // can initialize without the extra cold-start cost during deployment.
      const mammoth = require('mammoth');
      const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });
      if (!text.trim()) {
        throw new Error('El DOCX no contiene texto legible. Si es una imagen escaneada, conviértelo a PDF.');
      }
      responseText = await this.processText(text, prompt);
    } else if (mimeType === DOC_MIME_TYPE) {
      // Los archivos .doc binarios no se pueden enviar como inlineData a Gemini.
      const WordExtractor = require('word-extractor');
      const document = await new WordExtractor().extract(fileBuffer);
      const text = document.getBody();
      if (!text || !text.trim()) {
        throw new Error('El DOC no contiene texto legible. Si es una imagen escaneada, conviértelo a PDF.');
      }
      responseText = await this.processText(text, prompt);
    } else {
      responseText = await this.extractFromDocument(fileBuffer, mimeType, prompt);
    }
    
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
