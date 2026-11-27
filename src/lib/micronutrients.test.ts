import { describe, it, expect } from 'vitest';
import {
	parseMicrosJson,
	aggregateMicroCoverage,
	stringifyMicrosJson,
	scaleMicros,
	addMicros,
	computeRdaPercent,
	formatMicroValue,
	type EssentialMicros
} from './micronutrients';
import { extractOffMicros } from './server/nutrition';

describe('micronutrients utilities', () => {
	it('parseMicrosJson handles valid and invalid JSON correctly', () => {
		expect(parseMicrosJson(null)).toEqual({});
		expect(parseMicrosJson('')).toEqual({});
		expect(parseMicrosJson('not-json')).toEqual({});
		expect(parseMicrosJson('[]')).toEqual({});

		const sample = JSON.stringify({
			potassiumMg: 350.55,
			calciumMg: 120,
			magnesiumMg: -50, // negative should be ignored
			vitaminCMg: 45.2,
			saturatedFat: 2.5,
			monounsaturatedFat: 6.2,
			polyunsaturatedFat: 3.1,
			transFat: 0.1,
			unknownKey: 999
		});

		const parsed = parseMicrosJson(sample);
		expect(parsed.potassiumMg).toBe(350.55);
		expect(parsed.calciumMg).toBe(120);
		expect(parsed.magnesiumMg).toBeUndefined();
		expect(parsed.vitaminCMg).toBe(45.2);
		expect(parsed.saturatedFat).toBe(2.5);
		expect(parsed.monounsaturatedFat).toBe(6.2);
		expect(parsed.polyunsaturatedFat).toBe(3.1);
		expect(parsed.transFat).toBe(0.1);
		expect((parsed as Record<string, unknown>).unknownKey).toBeUndefined();
	});

	it('stringifyMicrosJson omits empty or zero values and returns null if no valid micros', () => {
		expect(stringifyMicrosJson(null)).toBeNull();
		expect(stringifyMicrosJson({})).toBeNull();
		expect(stringifyMicrosJson({ potassiumMg: 0, calciumMg: null })).toBeNull();

		const micros: EssentialMicros = {
			potassiumMg: 450,
			ironMg: 2.5,
			vitaminCMg: 0
		};

		const str = stringifyMicrosJson(micros);
		expect(str).not.toBeNull();
		const parsed = JSON.parse(str!);
		expect(parsed).toEqual({
			potassiumMg: 450,
			ironMg: 2.5
		});
	});

	it('scaleMicros properly scales all micronutrients by factor', () => {
		const base: EssentialMicros = {
			potassiumMg: 500,
			calciumMg: 200,
			ironMg: 4.2,
			vitaminCMg: 30
		};

		// 32g serving from 100g base (factor 0.32)
		const scaled = scaleMicros(base, 0.32);
		expect(scaled.potassiumMg).toBe(160);
		expect(scaled.calciumMg).toBe(64);
		expect(scaled.ironMg).toBe(1.34);
		expect(scaled.vitaminCMg).toBe(9.6);

		// Zero or negative factor returns empty
		expect(scaleMicros(base, 0)).toEqual({});
		expect(scaleMicros(base, -1)).toEqual({});
	});

	it('addMicros properly sums two EssentialMicros objects', () => {
		const a: EssentialMicros = {
			potassiumMg: 300,
			calciumMg: 100,
			ironMg: 1.5
		};
		const b: EssentialMicros = {
			potassiumMg: 250,
			magnesiumMg: 80,
			ironMg: 2.0
		};

		const sum = addMicros(a, b);
		expect(sum.potassiumMg).toBe(550);
		expect(sum.calciumMg).toBe(100);
		expect(sum.magnesiumMg).toBe(80);
		expect(sum.ironMg).toBe(3.5);
	});

	it('computeRdaPercent computes percentage capped at 999%', () => {
		expect(computeRdaPercent(0, 3500)).toBe(0);
		expect(computeRdaPercent(1750, 3500)).toBe(50);
		expect(computeRdaPercent(3500, 3500)).toBe(100);
		expect(computeRdaPercent(7000, 3500)).toBe(200);
		expect(computeRdaPercent(100000, 100)).toBe(999);
		expect(computeRdaPercent(50, 0)).toBe(0);
	});

	it('formatMicroValue formats properly for UI presentation', () => {
		expect(formatMicroValue(0, 'mg')).toBe('0 mg');
		expect(formatMicroValue(null, 'mcg')).toBe('0 mcg');
		expect(formatMicroValue(3500, 'mg')).toBe(`${Math.round(3500).toLocaleString()} mg`);
		expect(formatMicroValue(2.4, 'mcg')).toBe('2.4 mcg');
		expect(formatMicroValue(800, 'UI')).toBe('800 UI');
	});

	it('extractOffMicros extracts Open Food Facts nutrients across different units', () => {
		const rawNutriments = {
			// Potassium in grams: 0.56g = 560mg
			potassium_100g: 0.56,
			// Calcium in mg: 375mg with explicit unit
			calcium_100g: 375,
			calcium_unit: 'mg',
			// Magnesium in grams: 0.094g = 94mg
			magnesium_100g: 0.094,
			// Vitamin C in mg: 60mg
			'vitamin-c_100g': 60,
			'vitamin-c_unit': 'mg',
			// Vitamin D in mcg: 5mcg = 200 UI
			'vitamin-d_100g': 5,
			'vitamin-d_unit': 'µg',
			// Vitamin B12 in grams: 0.0000024g = 2.4mcg
			'vitamin-b12_100g': 0.0000024,
			// Salt 100g = 1g -> Sodium = (1 / 2.5) * 1000 = 400mg
			salt_100g: 1.0,
			// Sub-fats
			'saturated-fat_100g': 2.4,
			'monounsaturated-fat_100g': 5.8,
			'polyunsaturated-fat_100g': 3.2,
			'trans-fat_100g': 0.05
		};

		const micros = extractOffMicros(rawNutriments);
		expect(micros.potassiumMg).toBe(560);
		expect(micros.calciumMg).toBe(375);
		expect(micros.magnesiumMg).toBe(94);
		expect(micros.vitaminCMg).toBe(60);
		expect(micros.vitaminDIu).toBe(200);
		expect(micros.vitaminB12Mcg).toBe(2.4);
		expect(micros.sodiumMg).toBe(400);
		expect(micros.saturatedFat).toBe(2.4);
		expect(micros.monounsaturatedFat).toBe(5.8);
		expect(micros.polyunsaturatedFat).toBe(3.2);
		expect(micros.transFat).toBe(0.05);
	});
});

describe('aggregateMicroCoverage', () => {
	it('sums reported values and the kcal they describe, without treating missing data as zero', () => {
		const { kcal, micros } = aggregateMicroCoverage([
			{ kcal: 300, microsJson: JSON.stringify({ ironMg: 2, calciumMg: 100 }) },
			{ kcal: 500, microsJson: JSON.stringify({ ironMg: 1 }) },
			{ kcal: 200, microsJson: null }
		]);
		expect(kcal).toBe(1000);
		expect(micros.ironMg).toEqual({ total: 3, coveredKcal: 800 });
		expect(micros.calciumMg).toEqual({ total: 100, coveredKcal: 300 });
		expect(micros.vitaminCMg).toBeUndefined();
	});
});
