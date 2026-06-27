export type DeliveryMethod = 'DIRECT_DOWNLOAD' | 'APP_INSTALL' | 'WEB_DEPLOYMENT' | 'EMAIL_ATTACHMENT';

export interface DeliveryPackage {
    readonly assetId: string;
    readonly method: DeliveryMethod;
    readonly destination: string;
    readonly accessUrl?: string;
}
