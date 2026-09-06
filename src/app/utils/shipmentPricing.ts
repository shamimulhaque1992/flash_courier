/**
 * Pricing Engine for Flash Courier
 *
 * Intra-division (same division):
 *   1–5 kg   → 60 BDT
 *   5–10 kg  → 80 BDT
 *   10–15 kg → 100 BDT
 *   >15 kg   → 150 BDT
 *
 * Inter-division base rates (from → to):
 *   Same division  → 0 (handled above)
 *   CTG → Dhaka    → 120
 *   CTG → Rajshahi → 150
 *   All others     → 130 (default inter-division base)
 *
 * Weight surcharge on top of inter-division base:
 *   1–5 kg   → +0
 *   5–10 kg  → +20
 *   10–15 kg → +40
 *   >15 kg   → +90
 *
 * Fragile surcharge: +30 BDT
 */

const INTRA_DIVISION_RATES: Record<string, number> = {
	"1-5": 60,
	"5-10": 80,
	"10-15": 100,
	"15+": 150,
};

const WEIGHT_SURCHARGE: Record<string, number> = {
	"1-5": 0,
	"5-10": 20,
	"10-15": 40,
	"15+": 90,
};

const INTER_DIVISION_BASE: Record<string, number> = {
	"ctg-dhaka": 120,
	"dhaka-ctg": 120,
	"ctg-rajshahi": 150,
	"rajshahi-ctg": 150,
};

const DEFAULT_INTER_DIVISION_BASE = 130;
const FRAGILE_SURCHARGE = 30;

function getWeightBracket(weightKg: number): string {
	if (weightKg <= 5) return "1-5";
	if (weightKg <= 10) return "5-10";
	if (weightKg <= 15) return "10-15";
	return "15+";
}

function normalizeDivision(division: string): string {
	return division.trim().toLowerCase().replace(/\s+/g, "");
}

export interface IShipmentPricingInput {
	senderDivision: string;
	receiverDivision: string;
	weightKg: number;
	isFragile?: boolean;
}

export interface IShipmentPricingResult {
	baseRate: number;
	weightSurcharge: number;
	fragileSurcharge: number;
	totalFee: number;
	breakdown: {
		isIntraDivision: boolean;
		weightBracket: string;
	};
}

export const calculateShipmentFee = (
	input: IShipmentPricingInput,
): IShipmentPricingResult => {
	const { weightKg, isFragile = false } = input;
	const senderDiv = normalizeDivision(input.senderDivision);
	const receiverDiv = normalizeDivision(input.receiverDivision);

	const bracket = getWeightBracket(weightKg);
	const isIntraDivision = senderDiv === receiverDiv;

	let baseRate: number;
	let weightSurcharge: number;

	if (isIntraDivision) {
		baseRate = INTRA_DIVISION_RATES[bracket];
		weightSurcharge = 0;
	} else {
		const routeKey = `${senderDiv}-${receiverDiv}`;
		baseRate = INTER_DIVISION_BASE[routeKey] ?? DEFAULT_INTER_DIVISION_BASE;
		weightSurcharge = WEIGHT_SURCHARGE[bracket];
	}

	const fragileSurcharge = isFragile ? FRAGILE_SURCHARGE : 0;
	const totalFee = baseRate + weightSurcharge + fragileSurcharge;

	return {
		baseRate,
		weightSurcharge,
		fragileSurcharge,
		totalFee,
		breakdown: {
			isIntraDivision,
			weightBracket: bracket,
		},
	};
};
