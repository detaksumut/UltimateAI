export async function get(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'GET request failed');
  }
  return await res.json();
}

export async function post(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'POST request failed');
  }
  return await res.json();
}
