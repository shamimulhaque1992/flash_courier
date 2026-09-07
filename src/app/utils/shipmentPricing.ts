import { Division } from "../../generated/prisma/enums";

/**
 * Pricing Engine for Flash Courier
 *
 * Intra-division (same division): flat rate by weight
 *   1–5 kg   → 60 BDT
 *   5–10 kg  → 80 BDT
 *   10–15 kg → 100 BDT
 *   >15 kg   → 150 BDT
 *
 * Inter-division base rates (symmetric, based on geographic distance):
 *   Adjacent divisions  → 110 BDT
 *   Medium distance     → 130 BDT
 *   Long distance       → 150 BDT
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

const FRAGILE_SURCHARGE = 30;

// Full symmetric inter-division base rate matrix
// Rates based on geographic proximity across Bangladesh's 8 divisions
const INTER_DIVISION_BASE: Partial<Record<Division, Partial<Record<Division, number>>>> = {
	[Division.DHAKA]: {
		[Division.CHATTOGRAM]: 130,
		[Division.RAJSHAHI]:   120,
		[Division.KHULNA]:     120,
		[Division.BARISHAL]:   110,
		[Division.SYLHET]:     130,
		[Division.RANGPUR]:    150,
		[Division.MYMENSINGH]: 110,
	},
	[Division.CHATTOGRAM]: {
		[Division.DHAKA]:      130,
		[Division.RAJSHAHI]:   150,
		[Division.KHULNA]:     150,
		[Division.BARISHAL]:   130,
		[Division.SYLHET]:     130,
		[Division.RANGPUR]:    150,
		[Division.MYMENSINGH]: 140,
	},
	[Division.RAJSHAHI]: {
		[Division.DHAKA]:      120,
		[Division.CHATTOGRAM]: 150,
		[Division.KHULNA]:     120,
		[Division.BARISHAL]:   140,
		[Division.SYLHET]:     150,
		[Division.RANGPUR]:    110,
		[Division.MYMENSINGH]: 130,
	},
	[Division.KHULNA]: {
		[Division.DHAKA]:      120,
		[Division.CHATTOGRAM]: 150,
		[Division.RAJSHAHI]:   120,
		[Division.BARISHAL]:   110,
		[Division.SYLHET]:     150,
		[Division.RANGPUR]:    150,
		[Division.MYMENSINGH]: 140,
	},
	[Division.BARISHAL]: {
		[Division.DHAKA]:      110,
		[Division.CHATTOGRAM]: 130,
		[Division.RAJSHAHI]:   140,
		[Division.KHULNA]:     110,
		[Division.SYLHET]:     140,
		[Division.RANGPUR]:    150,
		[Division.MYMENSINGH]: 130,
	},
	[Division.SYLHET]: {
		[Division.DHAKA]:      130,
		[Division.CHATTOGRAM]: 130,
		[Division.RAJSHAHI]:   150,
		[Division.KHULNA]:     150,
		[Division.BARISHAL]:   140,
		[Division.RANGPUR]:    150,
		[Division.MYMENSINGH]: 120,
	},
	[Division.RANGPUR]: {
		[Division.DHAKA]:      150,
		[Division.CHATTOGRAM]: 150,
		[Division.RAJSHAHI]:   110,
		[Division.KHULNA]:     150,
		[Division.BARISHAL]:   150,
		[Division.SYLHET]:     150,
		[Division.MYMENSINGH]: 130,
	},
	[Division.MYMENSINGH]: {
		[Division.DHAKA]:      110,
		[Division.CHATTOGRAM]: 140,
		[Division.RAJSHAHI]:   130,
		[Division.KHULNA]:     140,
		[Division.BARISHAL]:   130,
		[Division.SYLHET]:     120,
		[Division.RANGPUR]:    130,
	},
};

function getWeightBracket(weightKg: number): string {
	if (weightKg <= 5) return "1-5";
	if (weightKg <= 10) return "5-10";
	if (weightKg <= 15) return "10-15";
	return "15+";
}

export interface IShipmentPricingInput {
	senderDivision: Division;
	receiverDivision: Division;
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
	const { senderDivision, receiverDivision, weightKg, isFragile = false } = input;

	const bracket = getWeightBracket(weightKg);
	const isIntraDivision = senderDivision === receiverDivision;

	let baseRate: number;
	let weightSurcharge: number;

	if (isIntraDivision) {
		baseRate = INTRA_DIVISION_RATES[bracket];
		weightSurcharge = 0;
	} else {
		baseRate = INTER_DIVISION_BASE[senderDivision]?.[receiverDivision] ?? 130;
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
