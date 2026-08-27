import React from 'react';
import { useMemberDashboard } from '../hooks/useMemberDashboard';

/**
 * MemberDashboard Page
 * Pure React Component. Only interacts with the ViewModel.
 * ZERO knowledge of backend entity structures, JSON shapes, or HTTP mechanics.
 */
export const MemberDashboard: React.FC = () => {
  // 1. Delegate everything to the Hook
  const { viewModel, loading, error } = useMemberDashboard();

  if (loading) return <div>Loading Profile...</div>;
  if (error) return <div>Error loading profile: {error}</div>;
  if (!viewModel) return <div>No profile data found.</div>;

  // 2. Render strictly from ViewModel
  return (
    <div className="dashboard-container p-6 bg-white rounded shadow-lg">
      <h1 className="text-2xl font-bold">Welcome, {viewModel.displayName}</h1>
      
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Status:</span>
          <span className={`px-2 py-1 rounded ${viewModel.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {viewModel.displayStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold">Roles:</span>
          <span className="text-gray-700">{viewModel.rolesList}</span>
        </div>
      </div>

      {viewModel.canRequestVerification && (
        <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Request Academic Verification
        </button>
      )}
    </div>
  );
};
