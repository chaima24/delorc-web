import { describe, expect, it } from 'vitest'
import { autoMatch, batches, buildRow, fileDuplicates, normalize } from '../hcpImport'

const label = (target: string) => ({ name: 'Nom', one_key_id: 'ID OneKey' } as Record<string, string>)[target] ?? target

describe('normalize', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalize('Code_Onekey')).toBe('code onekey')
    expect(normalize('  Spécialité ')).toBe('specialite')
  })
})

describe('autoMatch', () => {
  it('matches lab column names and the template labels', () => {
    expect(autoMatch(['Nom complet', 'Code Onekey', 'Wkp', 'Délégué', 'ID OneKey'], label)).toEqual(['name', 'one_key_id', 'wkp_id', null, null])
  })

  it('reads a bare "Nom" as the last name when there is a first-name column', () => {
    expect(autoMatch(['Prénom', 'Nom'], () => '')).toEqual(['first_name', 'last_name'])
    expect(autoMatch(['Nom'], () => '')).toEqual(['name'])
  })
})

describe('buildRow', () => {
  it('joins first and last name and splits GPS', () => {
    const row = buildRow(['Karim', 'Benali', '36,7431 ; 3,0412', 1234], ['first_name', 'last_name', 'gps', 'one_key_id'], 5)
    expect(row).toEqual({ row: 5, name: 'Karim Benali', latitude: '36.7431', longitude: '3.0412', one_key_id: '1234' })
  })

  it('reads "lat,lng" with dots', () => {
    expect(buildRow(['36.7431,3.0412'], ['gps'], 2)).toMatchObject({ latitude: '36.7431', longitude: '3.0412' })
  })
})

describe('fileDuplicates', () => {
  it('flags every repeat after the first line', () => {
    const problems = fileDuplicates([
      { row: 2, one_key_id: 'A', phone: '0550 11 22 33' },
      { row: 3, one_key_id: 'B', phone: '0550112233' },
      { row: 4, one_key_id: 'A' },
    ])
    expect(problems.get(2)).toBeUndefined()
    expect(problems.get(3)).toEqual([{ field: 'phone', code: 'duplicate', value: '0550112233', other: '2' }])
    expect(problems.get(4)?.[0]).toMatchObject({ field: 'one_key_id', other: '2' })
  })
})

describe('batches', () => {
  it('splits a list', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
