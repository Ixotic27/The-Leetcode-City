import { wrapInBaseTemplate } from '../email-template';

describe('email-template utilities (pure)', () => {
  it('wrapInBaseTemplate escapes unsubscribeUrl but keeps bodyHtml unchanged', () => {
    const html = wrapInBaseTemplate('<p>Hi</p>', 'https://example.com/?q=<x>&y=1');
    expect(html).toContain('<p>Hi</p>');
    expect(html).toContain('unsubscribe');
    expect(html).toContain('https://example.com/?q=&lt;x&gt;&amp;y=1');
  });

  it('wrapInBaseTemplate omits unsubscribe when unsubscribeUrl is undefined', () => {
    const html = wrapInBaseTemplate('<p>Hi</p>');
    expect(html).toContain('<p>Hi</p>');
    expect(html).not.toContain('unsubscribe');
  });
});

