// Regression tests for @supabase/supabase-js@2.116.0 upgrade.
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Supabase client query behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('sends a profile query through the Supabase REST client', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('[]', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();

    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', 'profile-1');

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();

    const request = fetchMock.mock.calls[0][0];
    const requestUrl = new URL(
      request instanceof Request ? request.url : String(request),
    );
    expect(requestUrl.pathname).toBe('/rest/v1/profiles');
    expect(requestUrl.searchParams.get('select')).toBe('id');
    expect(requestUrl.searchParams.get('id')).toBe('eq.profile-1');
  });
});
