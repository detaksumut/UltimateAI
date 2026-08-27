import { MemberID } from '../value-objects/MemberID';

export enum VerificationStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export class RequestID {
  constructor(public readonly value: string) {}
}

/**
 * VerificationRequest Aggregate Root
 * Designed as Immutable History.
 */
export class VerificationRequest {
  private _status: VerificationStatus;
  private _version: number;

  constructor(
    public readonly id: RequestID,
    public readonly targetMemberId: MemberID,
    public readonly documentUrls: string[]
  ) {
    this._status = VerificationStatus.SUBMITTED;
    this._version = 1;
  }

  public approve(): void {
    if (this._status !== VerificationStatus.SUBMITTED && this._status !== VerificationStatus.IN_REVIEW) {
      throw new Error('Can only approve pending requests.');
    }
    this._status = VerificationStatus.APPROVED;
    this._version++;
  }

  public reject(): void {
    if (this._status !== VerificationStatus.SUBMITTED && this._status !== VerificationStatus.IN_REVIEW) {
      throw new Error('Can only reject pending requests.');
    }
    this._status = VerificationStatus.REJECTED;
    this._version++;
  }

  public get status(): VerificationStatus {
    return this._status;
  }
}
