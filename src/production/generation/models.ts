export type AssetType = 'SOFTWARE_APK' | 'SOFTWARE_WEB' | 'MEDIA_VIDEO' | 'MEDIA_IMAGE' | 'DOC_PRESENTATION' | 'DOC_PDF';

export interface GenerationTask {
    readonly id: string;
    readonly blueprintId: string;
    readonly targetAsset: AssetType;
    readonly status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
}

export interface DigitalAsset {
    readonly taskId: string;
    readonly type: AssetType;
    readonly rawData: Buffer | string;
    readonly metadata: Record<string, string>;
}
