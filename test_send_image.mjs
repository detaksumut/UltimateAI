import fs from 'fs';
import { geminiProviderInstance } from './server/providers/GeminiProvider.mjs';

async function testGeminiSendImage() {
  console.log('Testing geminiProviderInstance.sendImage...');
  try {
    const result = await geminiProviderInstance.sendImage({
      prompt: 'A modern presentation slide infographic about academic partnership between universities',
      aspectRatio: '16:9'
    });
    console.log('Success! base64 length:', result.base64Data?.length, 'mime:', result.mimeType);
  } catch (err) {
    console.error('sendImage failed:', err.message);
  }
}

testGeminiSendImage();
