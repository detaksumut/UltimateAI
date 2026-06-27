export type FeatureType = 'CAMERA' | 'GPS' | 'MAP' | 'EXCEL_EXPORT' | 'QR_CODE' | 'VOICE' | 'VIDEO' | 'SIGNATURE' | 'GALLERY' | 'OFFLINE_SYNC' | 'PHOTO_ANNOTATION';

export interface ProductFeature {
    readonly type: FeatureType;
    readonly description: string;
    readonly isCoreExperience: boolean;
}

export interface FeatureSet {
    readonly blueprintId: string;
    readonly features: ReadonlyArray<ProductFeature>;
}
