/**
 * VisualChartCapture
 * Captures a user-authorized screen/window/tab for JIN visual chart analysis.
 *
 * Important: browser screen capture requires an explicit user gesture and permission.
 * This module does not bypass browser security and does not fabricate OHLC values.
 */
export class VisualChartCapture {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.lastCaptureAt = null;
  }

  get supported() {
    return typeof navigator !== 'undefined'
      && Boolean(navigator.mediaDevices?.getDisplayMedia)
      && typeof document !== 'undefined';
  }

  async start() {
    if (!this.supported) {
      throw new Error('Screen capture tidak didukung browser ini. Gunakan browser desktop modern.');
    }
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 2, max: 5 } },
      audio: false,
    });
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await new Promise((resolve, reject) => {
      this.video.onloadedmetadata = resolve;
      this.video.onerror = () => reject(new Error('Video screen capture gagal dimuat.'));
    });
    await this.video.play();
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stop());
  }

  capture({ quality = 0.88, maxWidth = 1600 } = {}) {
    if (!this.stream || !this.video || !this.canvas) {
      throw new Error('Screen capture belum aktif.');
    }
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error('Frame layar belum tersedia. Coba lagi sebentar.');
    }
    const scale = Math.min(1, maxWidth / this.video.videoWidth);
    this.canvas.width = Math.max(1, Math.round(this.video.videoWidth * scale));
    this.canvas.height = Math.max(1, Math.round(this.video.videoHeight * scale));
    const context = this.canvas.getContext('2d', { alpha: false });
    context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    this.lastCaptureAt = new Date().toISOString();
    return {
      dataUrl: this.canvas.toDataURL('image/jpeg', quality),
      capturedAt: this.lastCaptureAt,
      width: this.canvas.width,
      height: this.canvas.height,
      mimeType: 'image/jpeg',
    };
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
    this.canvas = null;
  }

  get active() {
    return Boolean(this.stream?.getVideoTracks().some(track => track.readyState === 'live'));
  }
}

export const visualChartCapture = new VisualChartCapture();
