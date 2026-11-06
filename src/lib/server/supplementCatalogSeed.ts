export interface SeedNutrient {
	name: string;
	amountPerUnit: number;
	unit: string;
}

export interface CatalogSeedItem {
	id: string;
	name: string;
	unit: string; // canonical: 'g', 'ml', 'Kapsel', 'Tablette', 'Stück'
	brand: string | null;
	info: string;
	keywords: string;
	defaultAmount: number;
	nutrients: SeedNutrient[];
}

export const CATALOG_SUPPLEMENTS: CatalogSeedItem[] = [
	{
		id: 'sc-creatine-monohydrate',
		name: 'Creatine Monohydrate',
		unit: 'g',
		brand: null,
		info: '5g daily for athletic strength, power output, and cognitive performance.',
		keywords: 'creatina monohidrato monohidratada polvo masa muscular fuerza resistencia creatine monohydrate powder strength creatin pulver kraft muskelaufbau',
		defaultAmount: 5,
		nutrients: [{ name: 'Creatine', amountPerUnit: 1, unit: 'g' }]
	},
	{
		id: 'sc-vitamin-d3',
		name: 'Vitamin D3',
		unit: 'Kapsel',
		brand: null,
		info: '2000 IU (50 µg) per capsule for bone density and immune system support.',
		keywords: 'vitamina d d3 colecalciferol sol huesos sistema inmune inmunidad vitamin d3 cholecalciferol immune bone sonnenvitamin immunsystem knochen',
		defaultAmount: 1,
		nutrients: [{ name: 'Vitamin D3', amountPerUnit: 2000, unit: 'IU' }]
	},
	{
		id: 'sc-magnesium-bisglycinate',
		name: 'Magnesium Bisglycinate',
		unit: 'Kapsel',
		brand: null,
		info: 'High bioavailability chelated magnesium for muscle relaxation, recovery, and sleep.',
		keywords: 'magnesio bisglicinato quelado citrato sueno descanso relajacion muscular calambres magnesium bisglycinate chelated sleep muscle relaxation schlaf muskelkrampfe',
		defaultAmount: 2,
		nutrients: [{ name: 'Magnesium', amountPerUnit: 150, unit: 'mg' }]
	},
	{
		id: 'sc-omega-3-fish-oil',
		name: 'Omega-3 Fish Oil',
		unit: 'Kapsel',
		brand: null,
		info: 'High-purity fish oil rich in EPA and DHA fatty acids for cardiovascular and brain health.',
		keywords: 'omega 3 3-omega aceite de pescado epa dha trigliceridos corazon cerebro cardiovascular fish oil lachsol fischol herz hirn fettsauren',
		defaultAmount: 2,
		nutrients: [
			{ name: 'EPA', amountPerUnit: 250, unit: 'mg' },
			{ name: 'DHA', amountPerUnit: 125, unit: 'mg' }
		]
	},
	{
		id: 'sc-multivitamin',
		name: 'Multivitamin',
		unit: 'Tablette',
		brand: null,
		info: 'Comprehensive daily essential vitamin and mineral blend for overall health.',
		keywords: 'multivitaminico multi vitaminico complejo vitaminico vitaminas minerales general daily multivitamin multivitamine vitamine mineralien all-in-one',
		defaultAmount: 1,
		nutrients: [
			{ name: 'Vitamin C', amountPerUnit: 80, unit: 'mg' },
			{ name: 'Vitamin D3', amountPerUnit: 400, unit: 'IU' },
			{ name: 'Zinc', amountPerUnit: 10, unit: 'mg' },
			{ name: 'Vitamin B12', amountPerUnit: 2.5, unit: 'µg' },
			{ name: 'Magnesium', amountPerUnit: 50, unit: 'mg' }
		]
	},
	{
		id: 'sc-zinc',
		name: 'Zinc',
		unit: 'Kapsel',
		brand: null,
		info: '15mg elemental zinc for immune defense, hormone production, and skin health.',
		keywords: 'zinc bisglicinato gluconato picolinato defensas testosterona inmunidad piel zink immunsystem abwehr haut',
		defaultAmount: 1,
		nutrients: [{ name: 'Zinc', amountPerUnit: 15, unit: 'mg' }]
	},
	{
		id: 'sc-vitamin-c',
		name: 'Vitamin C',
		unit: 'Tablette',
		brand: null,
		info: '1000mg antioxidant vitamin C for collagen synthesis and immune defense.',
		keywords: 'vitamina c acido ascorbico antioxidante colageno defensas inmunidad vitamin c ascorbic acid antioxydant immunsystem kollagen',
		defaultAmount: 1,
		nutrients: [{ name: 'Vitamin C', amountPerUnit: 1000, unit: 'mg' }]
	},
	{
		id: 'sc-melatonin',
		name: 'Melatonin',
		unit: 'Tablette',
		brand: null,
		info: 'Natural sleep regulator hormone to support sleep onset and circadian rhythm.',
		keywords: 'melatonina sueno dormir insomnio descanso ritmo circadiano melatonin sleep insomnia schlaf einschlafen nachtruhe',
		defaultAmount: 1,
		nutrients: [{ name: 'Melatonin', amountPerUnit: 1.5, unit: 'mg' }]
	},
	{
		id: 'sc-whey-protein',
		name: 'Whey Protein',
		unit: 'g',
		brand: null,
		info: 'Fast-digesting whey protein for muscle protein synthesis and post-workout recovery.',
		keywords: 'proteina whey protein en polvo suero de leche batido muscular isolate concentrado molkenprotein eiweiss shake muskelaufbau regeneration',
		defaultAmount: 30,
		nutrients: [
			{ name: 'Protein', amountPerUnit: 0.8, unit: 'g' },
			{ name: 'BCAA', amountPerUnit: 0.18, unit: 'g' }
		]
	},
	{
		id: 'sc-casein-protein',
		name: 'Casein Protein',
		unit: 'g',
		brand: null,
		info: 'Slow-digesting micellar casein protein ideal before bedtime for sustained amino acid release.',
		keywords: 'caseina proteina lenta absorcion nocturna caseinato micelar casein protein micellar slow digesting nachtprotein milchprotein',
		defaultAmount: 30,
		nutrients: [{ name: 'Protein', amountPerUnit: 0.8, unit: 'g' }]
	},
	{
		id: 'sc-ashwagandha',
		name: 'Ashwagandha (KSM-66)',
		unit: 'Kapsel',
		brand: null,
		info: 'Standardized adaptogenic root extract to reduce stress, lower cortisol, and support vitality.',
		keywords: 'ashwagandha ksm-66 ksm66 adaptogeno estres cortisol ansiedad relajacion withania somnifera stress relief calming entspannung',
		defaultAmount: 1,
		nutrients: [
			{ name: 'Ashwagandha Extract', amountPerUnit: 600, unit: 'mg' },
			{ name: 'Withanolides', amountPerUnit: 30, unit: 'mg' }
		]
	},
	{
		id: 'sc-l-theanine',
		name: 'L-Theanine',
		unit: 'Kapsel',
		brand: null,
		info: 'Amino acid from green tea promoting calm mental focus and reducing caffeine jitters.',
		keywords: 'l-teanina teanina l-theanine enfoque calma concentracion cafe te verde focus relaxation nootropic konzentration gruntee',
		defaultAmount: 1,
		nutrients: [{ name: 'L-Theanine', amountPerUnit: 200, unit: 'mg' }]
	},
	{
		id: 'sc-collagen-peptides',
		name: 'Collagen Peptides',
		unit: 'g',
		brand: null,
		info: 'Hydrolyzed collagen type I and III for joint cartilage, tendons, skin elasticity, and hair.',
		keywords: 'colageno hidrolizado colágeno peptidos piel articulaciones tendones cabello hydrolyzed collagen peptides skin joints kollagen hydrolysat gelenke haut',
		defaultAmount: 10,
		nutrients: [{ name: 'Hydrolyzed Collagen', amountPerUnit: 1, unit: 'g' }]
	},
	{
		id: 'sc-calcium-vitamin-d3',
		name: 'Calcium + Vitamin D3',
		unit: 'Tablette',
		brand: null,
		info: 'Synergistic calcium and vitamin D3 combination for bone mineral density and teeth strength.',
		keywords: 'calcio vitamina d d3 citrato de calcio huesos densidad osea calcium bone health knochen zahne',
		defaultAmount: 1,
		nutrients: [
			{ name: 'Calcium', amountPerUnit: 500, unit: 'mg' },
			{ name: 'Vitamin D3', amountPerUnit: 400, unit: 'IU' }
		]
	},
	{
		id: 'sc-iron-bisglycinate',
		name: 'Iron (Ferrous Bisglycinate)',
		unit: 'Kapsel',
		brand: null,
		info: 'Gentle on stomach chelated iron for hemoglobin production and combating fatigue.',
		keywords: 'hierro quelado bisglicinato ferroso anemia hemoglobina ferritina energia cansancio iron ferrous bisglycinate eisen blutbildung energie mudigkeit',
		defaultAmount: 1,
		nutrients: [{ name: 'Iron', amountPerUnit: 20, unit: 'mg' }]
	},
	{
		id: 'sc-probiotics',
		name: 'Probiotics (Multi-Strain)',
		unit: 'Kapsel',
		brand: null,
		info: 'Multi-strain live probiotic cultures for digestive balance and intestinal microbiome health.',
		keywords: 'probioticos flora intestinal digestion bacterias lactobacillus bifidobacterium probiotika darmflora verdauung mikrobiom',
		defaultAmount: 1,
		nutrients: [{ name: 'Probiotic Cultures', amountPerUnit: 10, unit: 'Billion CFU' }]
	},
	{
		id: 'sc-vitamin-b12',
		name: 'Vitamin B12 (Methylcobalamin)',
		unit: 'Tablette',
		brand: null,
		info: 'Active bioavailable methylcobalamin form of B12 for red blood cells and nerve function.',
		keywords: 'vitamina b12 metilcobalamina b-12 vegano globulos rojos energia sistema nervioso vitamin b12 methylcobalamin nerven blutbildung',
		defaultAmount: 1,
		nutrients: [{ name: 'Vitamin B12', amountPerUnit: 1000, unit: 'µg' }]
	},
	{
		id: 'sc-vitamin-b-complex',
		name: 'Vitamin B-Complex',
		unit: 'Kapsel',
		brand: null,
		info: 'Complete B-vitamin complex supporting cellular energy metabolism and nervous system.',
		keywords: 'complejo b vitaminas b b-complex b1 b2 b3 b6 b12 acido folico biotina energia sistema nervioso b-komplex energiestoffwechsel nervensystem',
		defaultAmount: 1,
		nutrients: [
			{ name: 'Vitamin B1', amountPerUnit: 25, unit: 'mg' },
			{ name: 'Vitamin B2', amountPerUnit: 25, unit: 'mg' },
			{ name: 'Vitamin B3', amountPerUnit: 50, unit: 'mg' },
			{ name: 'Vitamin B6', amountPerUnit: 25, unit: 'mg' },
			{ name: 'Folate', amountPerUnit: 400, unit: 'µg' },
			{ name: 'Vitamin B12', amountPerUnit: 100, unit: 'µg' }
		]
	},
	{
		id: 'sc-electrolytes-powder',
		name: 'Electrolytes Powder',
		unit: 'g',
		brand: null,
		info: 'Hydration formula with balanced sodium, potassium, and magnesium for endurance and hydration.',
		keywords: 'electrolitos sales minerales hidratacion sodio potasio magnesio intra entreno electrolytes hydration salze elektrolyte ausdauer',
		defaultAmount: 6,
		nutrients: [
			{ name: 'Sodium', amountPerUnit: 83.3, unit: 'mg' },
			{ name: 'Potassium', amountPerUnit: 41.7, unit: 'mg' },
			{ name: 'Magnesium', amountPerUnit: 16.7, unit: 'mg' }
		]
	},
	{
		id: 'sc-l-glutamine',
		name: 'L-Glutamine',
		unit: 'g',
		brand: null,
		info: 'Most abundant amino acid in muscular tissue for gut barrier integrity and muscle recovery.',
		keywords: 'glutamina l-glutamina recuperacion muscular pared intestinal inmune glutamine muscle recovery darmgesundheit darmschleimhaut',
		defaultAmount: 5,
		nutrients: [{ name: 'L-Glutamine', amountPerUnit: 1, unit: 'g' }]
	},
	{
		id: 'sc-spirulina',
		name: 'Spirulina',
		unit: 'Tablette',
		brand: null,
		info: 'Nutrient-dense blue-green microalgae rich in chlorophyll, antioxidants, and trace elements.',
		keywords: 'espirulina alga verde azul superalimento clorofila antioxidante spirulina superfood mikroalge chlorophyll nahstoffreich',
		defaultAmount: 4,
		nutrients: [{ name: 'Spirulina', amountPerUnit: 500, unit: 'mg' }]
	},
	{
		id: 'sc-glucosamine-chondroitin-msm',
		name: 'Glucosamine Chondroitin MSM',
		unit: 'Kapsel',
		brand: null,
		info: 'Triple action joint formula to support cartilage repair, joint lubrication, and mobility.',
		keywords: 'glucosamina condroitina msm articulaciones cartilago rodillas dolor articular joint support gelenkknorpel glukosamin chondroitin beweglichkeit',
		defaultAmount: 2,
		nutrients: [
			{ name: 'Glucosamine', amountPerUnit: 500, unit: 'mg' },
			{ name: 'Chondroitin', amountPerUnit: 200, unit: 'mg' },
			{ name: 'MSM', amountPerUnit: 150, unit: 'mg' }
		]
	},
	{
		id: 'sc-coq10',
		name: 'Coenzyme Q10 (CoQ10)',
		unit: 'Kapsel',
		brand: null,
		info: 'Cellular energy powerhouse and lipid-soluble antioxidant for cardiovascular vitality.',
		keywords: 'coenzima q10 q-10 ubiquinona antioxidante mitocondrias corazon energia coenzyme q10 ubichinon herzenergie kardiovaskular',
		defaultAmount: 1,
		nutrients: [{ name: 'Coenzyme Q10', amountPerUnit: 100, unit: 'mg' }]
	},
	{
		id: 'sc-curcumin-turmeric',
		name: 'Curcumin / Turmeric Extract',
		unit: 'Kapsel',
		brand: null,
		info: 'Standardized 95% curcuminoids extract enhanced with piperine for optimal joint and inflammatory response.',
		keywords: 'curcuma curcumina extracto antiinflamatorio piperina turmeric curcumin extract kurkuma entzundungshemmend gelenke bioperine',
		defaultAmount: 1,
		nutrients: [
			{ name: 'Curcumin Extract', amountPerUnit: 500, unit: 'mg' },
			{ name: 'Black Pepper Extract (Piperine)', amountPerUnit: 5, unit: 'mg' }
		]
	},
	{
		id: 'sc-pre-workout',
		name: 'Pre-Workout Blend',
		unit: 'g',
		brand: null,
		info: 'Pre-training ergogenic formula with caffeine, citrulline malate, and beta-alanine for energy and pumps.',
		keywords: 'pre entreno pre-workout oxido nitrico citrulina malato beta alanina cafeina energia pump preworkout trainingsbooster fokus energie',
		defaultAmount: 10,
		nutrients: [
			{ name: 'Citrulline Malate', amountPerUnit: 0.6, unit: 'g' },
			{ name: 'Beta-Alanine', amountPerUnit: 0.32, unit: 'g' },
			{ name: 'Caffeine', amountPerUnit: 20, unit: 'mg' }
		]
	}
];

// The 8 essential starter supplements that will be seeded directly into the user's active list
export const USER_ESSENTIAL_SUPPLEMENT_IDS = [
	'sc-creatine-monohydrate',
	'sc-vitamin-d3',
	'sc-magnesium-bisglycinate',
	'sc-omega-3-fish-oil',
	'sc-multivitamin',
	'sc-zinc',
	'sc-vitamin-c',
	'sc-melatonin'
];
