import { useState, useEffect } from 'react';
import { MemberDashboardViewModel, MemberProfileApiDTO } from '../viewmodels/MemberDashboardViewModel';

// Mock API Client generated from OpenAPI
const fetchMemberProfile = async (): Promise<MemberProfileApiDTO> => {
  return {
    academicId: 'APA-ID-001248',
    email: 'dr.doe@university.edu',
    status: 'ACTIVE',
    systemRole: 'VERIFIED_USER',
    organizationalRoles: ['MEMBER', 'REVIEWER']
  };
};

export const useMemberDashboard = () => {
  const [viewModel, setViewModel] = useState<MemberDashboardViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // 1. Fetch Raw API DTO
        const dto = await fetchMemberProfile();
        // 2. Map strictly to ViewModel
        const vm = MemberDashboardViewModel.fromApiDto(dto);
        setViewModel(vm);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return { viewModel, loading, error };
};
