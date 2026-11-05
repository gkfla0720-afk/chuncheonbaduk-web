import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

describe('runtime dependency smoke tests', () => {
  it('renders a React element through the server renderer', () => {
    const markup = renderToStaticMarkup(
      createElement('main', null, 'Chuncheon Baduk')
    );

    expect(markup).toBe('<main>Chuncheon Baduk</main>');
  });

  it('constructs a Supabase query without making a network request', () => {
    const client = createClient('https://example.supabase.co', 'test-anon-key');

    expect(client.from('profiles').select('id')).toBeDefined();
  });
});
