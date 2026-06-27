import { request, APIRequestContext } from '@playwright/test';

export async function resetTestDatabase(requestContext: APIRequestContext) {
  const res = await requestContext.post('http://localhost:3001/api/test/reset');
  if (!res.ok()) throw new Error('Failed to reset test DB');
}
