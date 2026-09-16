import { ImageEditingProvider } from './ImageEditingProvider.mjs';
import { IMAGE_WIDTH, IMAGE_HEIGHT } from '../ImageOutputConfig.mjs';
import { nineRouterGatewayAdapterInstance } from '../adapters/NineRouterGatewayAdapter.mjs';

export class NineRouterImageEditingProvider extends ImageEditingProvider {
  constructor() {
    super('9ROUTER');
  }

  async capabilityProbe(transport = null) {
    return {
      available: true,
      provider: this.name,
      reason: 'Unified 9Router Gateway Online',
      textToImage: false,
      imageToImage: true
    };
  }

  async editImage(params, transport = null) {
    const fetchFn = transport?.fetch || globalThis.fetch;
    const {
      referenceArtifactId = 'source',
      prompt = '',
      originalPrompt = '',
      requestId = `req-${Date.now()}`,
      signal
    } = params;

    console.log(`[IMAGE_REVISION] gateway=9ROUTER`);
    console.log(`[IMAGE_REVISION] originalPrompt="${originalPrompt}"`);
    console.log(`[IMAGE_REVISION] modificationPrompt="${prompt}"`);

    let width = params.width;
    let height = params.height;
    let ar = params.aspectRatio;

    if (!ar || ar === '1:1') {
      const combined = `${prompt} ${originalPrompt}`.toLowerCase();
      if (/\b(?:16[:x]9|16\/9|landscape|horizontal|mendatar|lebar|panjang)\b/i.test(combined)) {
        ar = '16:9';
      } else if (/\b(?:9[:x]16|9\/16|portrait|vertikal|tegak|story|wallpaper)\b/i.test(combined)) {
        ar = '9:16';
      }
    }

    try {
      const selectResult = await nineRouterGatewayAdapterInstance.select({
        aspectRatio: ar,
        fetchFn
      });
      
      if (!selectResult.ok) {
        return { success: false, error: selectResult.reason, reasonCode: selectResult.code };
      }

      const model = selectResult.model;
      console.log(`[IMAGE_REVISION] model=${model}`);
      console.log(`[IMAGE_REVISION] parentArtifactId=${referenceArtifactId}`);
      console.log(`[IMAGE_REVISION] referenceImageSent=true`);

      const adapterResult = await nineRouterGatewayAdapterInstance.generateImage({
        prompt: prompt || originalPrompt,
        model,
        size: selectResult.size,
        requestId: `revision-${Date.now()}`,
        signal,
        fetchFn,
        referenceImageBuffer: params.referenceImageBuffer,
        referenceMimeType: params.referenceMimeType,
        maskBuffer: params.maskBuffer
      });

      if (adapterResult.success && adapterResult.imageBytes) {
        console.log(`[IMAGE_REVISION] SUCCESS model=${adapterResult.model} bytes=${adapterResult.imageBytes.length}`);
        return {
          success: true,
          imageBuffer: adapterResult.imageBytes,
          mimeType: adapterResult.mimeType || 'image/jpeg',
          provider: '9ROUTER',
          modelUsed: adapterResult.model,
          parentArtifactId: referenceArtifactId,
          promptUsed: prompt || originalPrompt
        };
      }

      return {
        success: false,
        error: `Image revision failed: ${adapterResult.error || 'IMAGE_GENERATION_FAILED'}`,
        reasonCode: 'PROVIDER_EXECUTION_FAILED'
      };
    } catch (err) {
      return {
        success: false,
        error: `Image revision failed: ${err.message}`,
        reasonCode: 'PROVIDER_EXECUTION_FAILED'
      };
    }
  }
}

export const nineRouterImageEditingProviderInstance = new NineRouterImageEditingProvider();
