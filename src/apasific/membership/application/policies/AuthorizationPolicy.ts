import { SystemRole, OrganizationalRole } from '../../domain/aggregates/Member';

export interface Actor {
  memberId: string;
  systemRole: SystemRole;
  organizationalRoles: OrganizationalRole[];
}

/**
 * AuthorizationPolicy
 * Centralizes all access control logic outside of the Handlers.
 */
export class AuthorizationPolicy {
  public static canApproveVerification(actor: Actor): boolean {
    return actor.systemRole === SystemRole.ADMIN || actor.systemRole === SystemRole.SUPER_ADMIN;
  }

  public static canGrantRole(actor: Actor, targetRole: OrganizationalRole): boolean {
    // Only SUPER_ADMIN can grant CHIEF_EDITOR.
    if (targetRole === OrganizationalRole.CHIEF_EDITOR) {
      return actor.systemRole === SystemRole.SUPER_ADMIN;
    }
    // Admin or Governance Board can grant standard roles
    return actor.systemRole === SystemRole.ADMIN || actor.systemRole === SystemRole.SUPER_ADMIN;
  }

  public static canSuspendMember(actor: Actor): boolean {
    return actor.systemRole === SystemRole.ADMIN || actor.systemRole === SystemRole.SUPER_ADMIN;
  }

  public static canIssueMemberCard(actor: Actor, targetMemberId: string): boolean {
    // User can issue their own card, or an Admin can issue it.
    return actor.memberId === targetMemberId || actor.systemRole === SystemRole.ADMIN || actor.systemRole === SystemRole.SUPER_ADMIN;
  }
}
