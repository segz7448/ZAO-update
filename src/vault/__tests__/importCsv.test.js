import { parseCsvRows, parsePasswordCsv, importSelectionSummary } from '../importCsv';

describe('parseCsvRows', () => {
  test('handles quotes and commas', () => {
    const rows = parseCsvRows('a,b,"c,d"\n1,2,"3,4"\n');
    expect(rows).toEqual([
      ['a', 'b', 'c,d'],
      ['1', '2', '3,4'],
    ]);
  });
});

describe('parsePasswordCsv', () => {
  test('Chrome / Google Password Manager', () => {
    const csv = [
      'name,url,username,password,note',
      'GitHub,https://github.com,alice,s3cret,work',
      'Gmail,https://gmail.com,bob@x.com,pass,',
    ].join('\n');
    const r = parsePasswordCsv(csv);
    expect(r.success).toBe(true);
    expect(r.format).toBe('chrome');
    expect(r.items).toHaveLength(2);
    expect(r.items[0].username).toBe('alice');
    expect(r.items[0].password).toBe('s3cret');
  });

  test('Bitwarden', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      ',,login,GitHub,,,0,https://github.com,alice,pw,otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP',
    ].join('\n');
    const r = parsePasswordCsv(csv);
    expect(r.success).toBe(true);
    expect(r.format).toBe('bitwarden');
    expect(r.items[0].totp).toMatch(/^otpauth:/);
  });

  test('1Password', () => {
    const csv = 'Title,Url,Username,Password,Notes,OTPAuth\nBank,https://bank.com,me,pw,note,\n';
    const r = parsePasswordCsv(csv);
    expect(r.success).toBe(true);
    expect(r.format).toBe('1password');
    expect(r.items[0].name).toBe('Bank');
  });

  test('LastPass', () => {
    const csv = 'url,username,password,totp,extra,name,grouping,fav\nhttps://x.com,u,p,,,X,,0\n';
    const r = parsePasswordCsv(csv);
    expect(r.success).toBe(true);
    expect(['lastpass', 'chrome', 'generic']).toContain(r.format);
    expect(r.items[0].name).toBe('X');
  });

  test('selection summary', () => {
    const items = [
      { selected: true, totp: 'x' },
      { selected: false, totp: null },
      { selected: true, totp: null },
    ];
    expect(importSelectionSummary(items)).toEqual({ total: 3, selected: 2, withTotp: 1 });
  });
});
