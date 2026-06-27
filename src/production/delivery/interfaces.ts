import { DeliveryPackage } from './models';
import { DigitalAsset } from '../generation/models';

export interface IDeliveryService {
    deliver(asset: DigitalAsset, method: DeliveryMethod): Promise<DeliveryPackage>;
}
