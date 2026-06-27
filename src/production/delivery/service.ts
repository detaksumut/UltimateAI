import { IDeliveryService } from './interfaces';
import { DeliveryPackage, DeliveryMethod } from './models';
import { DigitalAsset } from '../generation/models';
import { RouterManager } from '../../infrastructure/connectors/routerManager';

export class DeliveryService implements IDeliveryService {
    constructor(private router: RouterManager) {}

    async deliver(asset: DigitalAsset, method: DeliveryMethod): Promise<DeliveryPackage> {
        console.log(`[DeliveryService] Packaging asset ${asset.taskId} for ${method}`);
        
        // The router might be used here to write an instruction manual or deployment script
        const response = await this.router.routeTask({
            id: `delivery-${Date.now()}`,
            prompt: `Generate delivery instructions for asset type ${asset.type} via ${method}`,
            requiredCapability: 'FAST_INFERENCE'
        });

        return {
            assetId: asset.taskId,
            method: method,
            destination: 'user_device',
            accessUrl: `https://ultimateai.local/deliveries/${asset.taskId}`
        };
    }
}
