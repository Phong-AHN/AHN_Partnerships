import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';
import { dollarsToMinor, minorToDollarsInput } from './money';
import { parsePartnerCsv, splitContacts } from './partner-import';

const HEADER = 'name,sector,contacts,ask_type,priority,stage,existing,amount_usd,summary';

describe('parseCsv / toCsv', () => {
  it('reads quoted fields, doubled quotes, embedded commas and newlines', () => {
    const text = '﻿a,b,c\r\n"x, y","He said ""hi""","line 1\nline 2"\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'He said "hi"', 'line 1\nline 2'],
    ]);
  });

  it('round-trips through the writer', () => {
    const rows = [
      ['Bank of America', 'Jaspal "JP" Dhillon', 'a, b'],
      ['Google', '', 'multi\nline'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('defuses spreadsheet formulas but leaves phone numbers alone', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1 555 0100', '-5', '@cmd']])).toBe(
      `"'=HYPERLINK(""x"")",+1 555 0100,-5,'@cmd\r\n`,
    );
  });
});

describe('money', () => {
  it('turns dollar strings into cents', () => {
    expect(dollarsToMinor('50,000')).toBe(5_000_000);
    expect(dollarsToMinor('$1,250.50')).toBe(125_050);
    expect(dollarsToMinor('')).toBeNull();
    expect(dollarsToMinor('fifty')).toBeNaN();
    expect(dollarsToMinor('-5')).toBeNaN();
    expect(minorToDollarsInput(5_000_000)).toBe('50000');
    expect(minorToDollarsInput(1_050)).toBe('10.50');
  });
});

describe('parsePartnerCsv', () => {
  it('reads the appendix format', () => {
    const { rows, issues } = parsePartnerCsv(
      [
        HEADER,
        'Azurium,PROFESSIONAL_SERVICES,Hieu Le; Anurag Kakar,CM,IN_MOTION,PROPOSAL_SENT,0,50000,"$50K AHF partnership proposal - close it."',
        'Bank of America,BANKING_FINANCIAL,"Jaspal ""JP"" Dhillon",CM,NEXT_OUTREACH,PROSPECT,0,,"Corporate membership + banking"',
        'Google,TECH_COMMERCE_SMB,,SC,BACKLOG,CONTACTED,1,,"Founder/community programming"',
      ].join('\n'),
    );
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      line: 2,
      name: 'Azurium',
      contacts: ['Hieu Le', 'Anurag Kakar'],
      priority: 'IN_MOTION',
      deal: {
        askType: 'CORPORATE_MEMBERSHIP',
        stage: 'PROPOSAL_SENT',
        amountMinor: 5_000_000,
        year: 2027,
        entity: 'AHN',
        title: '2027 Corporate Membership',
      },
    });
    expect(rows[1]?.contacts).toEqual(['Jaspal "JP" Dhillon']);
    expect(rows[2]).toMatchObject({ existingRelationship: true, contacts: [] });
  });

  it('reports every problem on a line, with its line number', () => {
    const { rows, issues } = parsePartnerCsv(
      [
        HEADER,
        ',NOT_A_SECTOR,,XX,,,maybe,abc,',
        'Steller,CORPORATE_CONSUMER_MEDIA,,CM,,PROPOSAL_SENT,0,,',
        'Comcast,TECH_COMMERCE_SMB,,CM,,WON,0,,',
      ].join('\n'),
    );
    expect(rows).toEqual([]);
    expect(issues.map((issue) => issue.line)).toEqual([2, 3, 4]);
    expect(issues[0]?.message).toMatch(/name is empty/);
    expect(issues[0]?.message).toMatch(/sector/);
    expect(issues[0]?.message).toMatch(/ask_type/);
    expect(issues[0]?.message).toMatch(/existing/);
    expect(issues[0]?.message).toMatch(/amount_usd/);
    expect(issues[1]?.message).toMatch(/needs a tier/);
    expect(issues[2]?.message).toMatch(/cannot be imported/);
  });

  it('refuses the same partner twice in one file', () => {
    const { issues } = parsePartnerCsv(
      [HEADER, 'Meta,TECH_COMMERCE_SMB,,,,,,,', 'meta,TECH_COMMERCE_SMB,,,,,,,'].join('\n'),
    );
    expect(issues).toEqual([{ line: 3, message: '"meta" is also on line 2' }]);
  });

  it('names missing required columns', () => {
    expect(parsePartnerCsv('name,contacts\nX,Y').issues[0]?.message).toBe(
      'Missing column: sector.',
    );
  });

  it('imports a partner without a deal when ask_type is empty', () => {
    const { rows } = parsePartnerCsv('name,sector\nJLL,PROFESSIONAL_SERVICES');
    expect(rows[0]?.deal).toBeNull();
    expect(rows[0]?.priority).toBe('BACKLOG');
  });

  it('splits contacts on semicolons', () => {
    expect(splitContacts(' Diana Choi ;NYAFF team; ')).toEqual(['Diana Choi', 'NYAFF team']);
  });
});
