import { MemberID } from '../value-objects/MemberID';
import { AcademicID } from '../value-objects/AcademicID';
import { MemberRegistered, MembershipActivated } from '../events/MembershipEvents';
import { IDomainEvent } from '../events/MembershipEvents';

export enum SystemRole {
  GUEST = 'GUEST',
  AUTHENTICATED = 'AUTHENTICATED',
  VERIFIED_USER = 'VERIFIED_USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum OrganizationalRole {
  MEMBER = 'MEMBER',
  REVIEWER = 'REVIEWER',
  EDITOR = 'EDITOR',
  CHIEF_EDITOR = 'CHIEF_EDITOR',
  ASSESSOR = 'ASSESSOR'
}

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED'
}

/**
 * Member Aggregate Root
 * Enforces strict architectural invariants. Not a God Aggregate.
 */
export class Member {
  private _domainEvents: IDomainEvent[] = [];
  
  // Aggregate State
  private _academicId?: AcademicID;
  private _systemRole: SystemRole;
  private _organizationalRoles: OrganizationalRole[];
  private _status: MembershipStatus;
  private _version: number;

  private constructor(
    public readonly id: MemberID,
    public readonly email: string,
    systemRole: SystemRole,
    status: MembershipStatus
  ) {
    this._systemRole = systemRole;
    this._status = status;
    this._organizationalRoles = [];
    this._version = 1;
  }

  // Factory Method
  public static registerNew(id: MemberID, email: string): Member {
    const member = new Member(id, email, SystemRole.AUTHENTICATED, MembershipStatus.PENDING);
    member.addDomainEvent(new MemberRegistered(id.value, email));
    return member;
  }

  // Aggregate Mutation Methods
  public activate(academicId: AcademicID): void {
    // Invariant: AcademicID can only be set once.
    if (this._academicId) {
      throw new Error('Member already has an AcademicID.');
    }
    this._academicId = academicId;
    this._status = MembershipStatus.ACTIVE;
    this._systemRole = SystemRole.VERIFIED_USER;
    this.grantOrganizationalRole(OrganizationalRole.MEMBER);
    
    this._version++;
    this.addDomainEvent(new MembershipActivated(this.id.value, academicId.value));
  }

  public grantOrganizationalRole(role: OrganizationalRole): void {
    // Invariant: Reviewer must be VERIFIED
    if (role === OrganizationalRole.REVIEWER && this._systemRole !== SystemRole.VERIFIED_USER) {
      throw new Error('Only VERIFIED_USER can become a REVIEWER.');
    }
    // Invariant: Chief Editor cannot be granted without prior roles
    if (role === OrganizationalRole.CHIEF_EDITOR && !this._organizationalRoles.includes(OrganizationalRole.EDITOR)) {
      throw new Error('Must be an EDITOR before becoming CHIEF_EDITOR.');
    }

    if (!this._organizationalRoles.includes(role)) {
      this._organizationalRoles.push(role);
      this._version++;
    }
  }

  // Event Handling
  private addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  public get domainEvents(): IDomainEvent[] {
    return [...this._domainEvents];
  }

  // Getters
  public get academicId(): AcademicID | undefined { return this._academicId; }
  public get systemRole(): SystemRole { return this._systemRole; }
  public get status(): MembershipStatus { return this._status; }
  public get version(): number { return this._version; }
}
