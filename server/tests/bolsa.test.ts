import { describe, it, expect } from 'vitest';

/**
 * Formula: V_efetivo = V_nominal * (1 + k/3)
 * k ∈ {0, 1, 2, 3}
 *
 * Same function as in server/src/routes/folha.ts:calcularValorMensal
 */
function calcularValorMensal(nominal: number, nivel: number): number {
  return nominal * (1 + nivel / 3);
}

describe('calcularValorMensal (CAPES scholarship formula)', () => {
  const TOLERANCE = 0.01;

  it('k=0: returns nominal value (no complement)', () => {
    expect(calcularValorMensal(3100, 0)).toBeCloseTo(3100, 2);
    expect(calcularValorMensal(700, 0)).toBeCloseTo(700, 2);
    expect(calcularValorMensal(6500, 0)).toBeCloseTo(6500, 2);
  });

  it('k=1: adds 1/3 complement (factor 4/3)', () => {
    expect(calcularValorMensal(3100, 1)).toBeCloseTo(3100 * (4 / 3), 2);
    expect(calcularValorMensal(2100, 1)).toBeCloseTo(2100 * (4 / 3), 2);
  });

  it('k=2: adds 2/3 complement (factor 5/3)', () => {
    expect(calcularValorMensal(3100, 2)).toBeCloseTo(3100 * (5 / 3), 2);
    expect(calcularValorMensal(5200, 2)).toBeCloseTo(5200 * (5 / 3), 2);
  });

  it('k=3: adds full complement (factor 2x nominal)', () => {
    expect(calcularValorMensal(3100, 3)).toBeCloseTo(6200, 2);
    expect(calcularValorMensal(700, 3)).toBeCloseTo(1400, 2);
    expect(calcularValorMensal(2100, 3)).toBeCloseTo(4200, 2);
    expect(calcularValorMensal(5200, 3)).toBeCloseTo(10400, 2);
    expect(calcularValorMensal(6500, 3)).toBeCloseTo(13000, 2);
  });

  it('k=3 value is exactly 2x nominal', () => {
    const nominals = [700, 2100, 3100, 5200, 6500];
    for (const n of nominals) {
      expect(calcularValorMensal(n, 3)).toBe(n * 2);
    }
  });

  it('values are monotonically increasing with k', () => {
    const nominal = 3100;
    const v0 = calcularValorMensal(nominal, 0);
    const v1 = calcularValorMensal(nominal, 1);
    const v2 = calcularValorMensal(nominal, 2);
    const v3 = calcularValorMensal(nominal, 3);
    expect(v0).toBeLessThan(v1);
    expect(v1).toBeLessThan(v2);
    expect(v2).toBeLessThan(v3);
  });

  it('all canonical CAPES nominal values work', () => {
    const cases = [
      { nominal: 700, k: 0, expected: 700 },
      { nominal: 2100, k: 0, expected: 2100 },
      { nominal: 3100, k: 0, expected: 3100 },
      { nominal: 5200, k: 0, expected: 5200 },
      { nominal: 6500, k: 0, expected: 6500 },
      { nominal: 700, k: 3, expected: 1400 },
      { nominal: 2100, k: 3, expected: 4200 },
      { nominal: 3100, k: 3, expected: 6200 },
      { nominal: 5200, k: 3, expected: 10400 },
      { nominal: 6500, k: 3, expected: 13000 },
    ];
    for (const { nominal, k, expected } of cases) {
      expect(calcularValorMensal(nominal, k)).toBeCloseTo(expected, 2);
    }
  });
});
