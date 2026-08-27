// 1. OpenAPI DTO (Raw response from the backend contract)
export interface MemberProfileApiDTO {
  academicId: string;
  email: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  systemRole: string;
  organizationalRoles: string[];
}

// 2. ViewModel (Strictly crafted for the React Component)
export class MemberDashboardViewModel {
  constructor(
    public readonly displayName: string,
    public readonly displayStatus: string,
    public readonly isVerified: boolean,
    public readonly rolesList: string,
    public readonly canRequestVerification: boolean
  ) {}

  // Mapper Function: API DTO -> ViewModel
  public static fromApiDto(dto: MemberProfileApiDTO): MemberDashboardViewModel {
    const isVerified = dto.status === 'ACTIVE';
    return new MemberDashboardViewModel(
      dto.academicId || dto.email, // Fallback if not verified yet
      dto.status.charAt(0) + dto.status.slice(1).toLowerCase(),
      isVerified,
      dto.organizationalRoles.join(', ') || 'No Roles',
      dto.status === 'PENDING' // Business logic mapping for UI state
    );
  }
}
