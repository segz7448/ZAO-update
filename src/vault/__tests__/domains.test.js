import { normalizeWebsite, suggestDomains, isValidEmail, isValidPhoneNational } from '../domains';

describe('domains', () => {
  test('normalizeWebsite', () => {
    expect(normalizeWebsite('https://www.GitHub.com/path')).toBe('github.com');
  });
  test('suggestDomains filters', () => {
    const s = suggestDomains('git');
    expect(s.some((d) => d.domain.includes('github'))).toBe(true);
  });
  test('email validation', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
  test('phone national', () => {
    expect(isValidPhoneNational('4155552671')).toBe(true);
    expect(isValidPhoneNational('12')).toBe(false);
  });
});
