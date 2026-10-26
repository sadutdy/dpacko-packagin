// PLACEHOLDER DATA — sizes, packs and MOQs are illustrative until the owner supplies specs.
export interface Variant {
  name: string;
  detail: string;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  variants: Variant[];
  packSizes: string[];
  moq: string;
  bestFor: string;
  accent: string;
  image?: { src: string; alt: string; width: number; height: number };
}

export const PRODUCTS: Product[] = [
  {
    slug: 'broast-boxes',
    name: 'Broast Boxes',
    tagline: 'Grease-resistant boxes for broast & fried chicken',
    description:
      'Sturdy, vented boxes that keep broast crisp and hot. Plain or printed with your shop logo.',
    variants: [
      { name: 'Quarter', detail: '1–2 pieces' },
      { name: 'Half', detail: '3–4 pieces' },
      { name: 'Full', detail: '6–8 pieces' },
      { name: 'Family', detail: '12+ pieces' },
    ],
    packSizes: ['50 pcs', '100 pcs', '250 pcs', '500 pcs'],
    bestFor: 'Broast, fried chicken, wings, fries combos',
    moq: 'Retail from 50 pcs · wholesale from 1,000 pcs',
    accent: '#f59e0b',
    // Illustration placeholder — replace with a real photo.
    image: {
      src: '/images/broast-boxes.svg',
      alt: 'Illustration of a D PACKO broast chicken box on an orange pedestal',
      width: 800,
      height: 700,
    },
  },
  {
    slug: 'shawarma-boxes',
    name: 'Shawarma Boxes',
    tagline: 'Roll and plate boxes for shawarma & wraps',
    description:
      'Food-safe boxes sized for rolls, wraps and plates. Easy to stack, easy to carry.',
    variants: [
      { name: 'Roll box', detail: 'Single roll' },
      { name: 'Double roll', detail: 'Two rolls' },
      { name: 'Plate box', detail: 'Plate with sides' },
    ],
    packSizes: ['100 pcs', '250 pcs', '500 pcs', '1,000 pcs'],
    bestFor: 'Shawarma rolls, wraps, grills, plates',
    moq: 'Retail from 100 pcs · wholesale from 2,000 pcs',
    accent: '#ea580c',
    // Illustration placeholder — replace with a real photo.
    image: {
      src: '/images/shawarma-boxes.svg',
      alt: 'Illustration of a D PACKO shawarma roll box with a wrap on a teal pedestal',
      width: 800,
      height: 700,
    },
  },
  {
    slug: 'cake-boxes',
    name: 'Cake Boxes',
    tagline: 'Bakery cake boxes from ½ kg to 2 kg',
    description:
      'Clean white boxes with or without a window, with matching cake boards available.',
    variants: [
      { name: '½ kg', detail: '8×8×5 in' },
      { name: '1 kg', detail: '10×10×5 in' },
      { name: '2 kg', detail: '12×12×6 in' },
      { name: 'Window', detail: 'Clear PET window' },
    ],
    packSizes: ['25 pcs', '50 pcs', '100 pcs', '250 pcs'],
    bestFor: 'Birthday and celebration cakes, pastries, cupcakes',
    moq: 'Retail from 25 pcs · wholesale from 500 pcs',
    accent: '#c2410c',
    image: {
      src: '/images/cake-boxes.jpg',
      alt: 'D PACKO cake box 8x8x5 inch with a printed chocolate cake design',
      width: 804,
      height: 700,
    },
  },
  {
    slug: 'burger-boxes',
    name: 'Burger Boxes',
    tagline: 'Printed 4×4×3 in burger boxes in assorted designs',
    description:
      'Compact, sturdy burger boxes with bold printed designs. Ready-made stock in several colours.',
    variants: [
      { name: 'Standard', detail: '4×4×3 in' },
      { name: 'Printed', detail: 'Custom logo on larger runs' },
    ],
    packSizes: ['50 pcs', '100 pcs', '250 pcs', '500 pcs'],
    bestFor: 'Burgers, sandwiches, small snacks',
    moq: 'Retail from 50 pcs · wholesale from 1,000 pcs',
    accent: '#16a34a',
    image: {
      src: '/images/burger-boxes.jpg',
      alt: 'Stack of four printed D PACKO burger boxes, 4x4x3 inch',
      width: 600,
      height: 840,
    },
  },
];
