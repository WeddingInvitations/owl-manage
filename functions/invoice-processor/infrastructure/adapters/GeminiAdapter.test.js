const assert = require('node:assert/strict');
const { test } = require('node:test');
const JSZip = require('jszip');
const WordExtractor = require('word-extractor');
const { GeminiAdapter } = require('./GeminiAdapter');

test('extrae texto de un DOCX de Drive y lo envía a Gemini como texto', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Factura prueba DOCX</w:t></w:r></w:p></w:body></w:document>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const adapter = Object.create(GeminiAdapter.prototype);
  let input;
  adapter.processText = async (text, prompt) => {
    input = { text, prompt };
    return '{"number":"DOCX-001"}';
  };
  adapter.extractFromDocument = () => { throw new Error('No se debe enviar DOCX como archivo binario'); };

  const result = await adapter.extractJSON(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', { number: 'string' });

  assert.deepEqual(result, { number: 'DOCX-001' });
  assert.match(input.text, /Factura prueba DOCX/);
  assert.match(input.prompt, /number/);
});

test('extrae texto de un .doc binario antes de llamar a Gemini', async () => {
  const originalExtract = WordExtractor.prototype.extract;
  const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
  WordExtractor.prototype.extract = async (receivedBuffer) => {
    assert.equal(receivedBuffer, buffer);
    return { getBody: () => 'Factura DOC antigua' };
  };
  try {
    const adapter = Object.create(GeminiAdapter.prototype);
    adapter.extractFromDocument = () => { throw new Error('No se debe enviar DOC como archivo binario'); };
    adapter.processText = async (text) => {
      assert.match(text, /Factura DOC antigua/);
      return '{"number":"DOC-001"}';
    };
    const result = await adapter.extractJSON(buffer, 'application/msword', { number: 'string' });
    assert.deepEqual(result, { number: 'DOC-001' });
  } finally {
    WordExtractor.prototype.extract = originalExtract;
  }
});