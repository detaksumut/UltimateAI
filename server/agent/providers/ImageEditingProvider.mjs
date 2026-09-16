/**
 * ImageEditingProvider.mjs
 * Base interface and contract for TRUE Image-to-Image / Image Editing providers in UltimateAI.
 * 
 * Invariants:
 * 1. imageToImage capability MUST be declared truthfully.
 * 2. editImage() MUST receive the raw referenceImageBuffer, mimeType, and modification prompt.
 * 3. Never fake image-to-image by discarding image bytes.
 */

export class ImageEditingProvider {
  constructor(name = 'BASE_IMAGE_EDITING_PROVIDER') {
    this.name = name;
  }

  /**
   * Capability probe for the provider.
   * @returns {Promise<{ available: boolean, provider: string, reason?: string, textToImage: boolean, imageToImage: boolean }>}
   */
  async capabilityProbe() {
    return {
      available: false,
      provider: this.name,
      reason: 'Base provider is not directly executable.',
      textToImage: false,
      imageToImage: true
    };
  }

  /**
   * Execute true image-to-image editing.
   * @param {Object} params
   * @param {Buffer} params.referenceImageBuffer - The physical image bytes of the source artifact
   * @param {string} params.referenceMimeType - MIME type of the input image (e.g. 'image/jpeg', 'image/png')
   * @param {string} params.referenceArtifactId - ID of the source artifact for lineage tracking
   * @param {string} params.prompt - Modification/revision prompt
   * @param {string} [params.negativePrompt]
   * @param {number} [params.width]
   * @param {number} [params.height]
   * @param {number} [params.seed]
   * @param {string} [params.requestId]
   * @param {AbortSignal} [params.signal]
   * @returns {Promise<{ success: boolean, imageBuffer?: Buffer, mimeType?: string, model?: string, error?: string }>}
   */
  async editImage(params) {
    throw new Error(`[ImageEditingProvider] editImage() must be implemented by subclass ${this.name}`);
  }

  async isAvailable() {
    const probe = await this.capabilityProbe();
    return Boolean(probe.available);
  }
}

export default ImageEditingProvider;
