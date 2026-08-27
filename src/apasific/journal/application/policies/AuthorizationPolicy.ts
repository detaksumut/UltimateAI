export class AuthorizationPolicy {
  
  public static canSubmitArticle(memberRoles: string[], memberStatus: string): boolean {
    // Member must be active. (AcademicID existence should be verified here or via integration).
    return memberStatus === 'ACTIVE';
  }

  public static canDeskReview(memberRoles: string[]): boolean {
    return memberRoles.includes('EDITOR') || memberRoles.includes('CHIEF_EDITOR');
  }

  public static canAssignReviewer(memberRoles: string[]): boolean {
    return memberRoles.includes('EDITOR') || memberRoles.includes('CHIEF_EDITOR');
  }

  public static canRecordDecision(memberRoles: string[]): boolean {
    return memberRoles.includes('CHIEF_EDITOR') || memberRoles.includes('SECTION_EDITOR');
  }

  public static canPublishIssue(memberRoles: string[]): boolean {
    return memberRoles.includes('MANAGING_EDITOR') || memberRoles.includes('CHIEF_EDITOR');
  }
}
