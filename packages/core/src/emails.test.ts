import { describe, expect, it } from 'vitest';
import { renderInviteEmail, renderSignInEmail } from './emails';

const URL_ = 'https://partners.example/sign-in/verify?token=abc&next=%2Fpipeline';

describe('emails', () => {
  it('puts the link in both the text and the HTML, escaped in HTML', () => {
    const email = renderSignInEmail({ name: 'Bryan Pham', url: URL_, minutes: 15 });
    expect(email.subject).toBe('Your AHN Partnerships sign-in link');
    expect(email.text).toContain(URL_);
    expect(email.text).toMatch(/^Hi Bryan,/);
    expect(email.text).toContain('expires in 15 minutes');
    expect(email.html).toContain('token=abc&amp;next=%2Fpipeline');
  });

  it('escapes names, so a name cannot inject markup', () => {
    const email = renderInviteEmail({
      name: '<script>alert(1)</script>',
      inviterName: 'Phong "Admin"',
      url: URL_,
      days: 7,
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('Phong &quot;Admin&quot;');
    expect(email.subject).toBe('Phong "Admin" invited you to AHN Partnerships');
    expect(email.text).toContain('expires in 7 days');
  });
});
