export const SITE = {
  name: 'D PACKO Packaging Solutions',
  short: 'D PACKO',
  phoneDisplay: '+91 98469 94836',
  phoneTel: '+919846994836',
  whatsapp: '919846994836',
  address: ['29/229, Melmuri', 'Calicut Road, Malappuram', 'Kerala 676517'],
  gstin: '32FJIPS7458N1ZB',
  instagram: 'https://www.instagram.com/dpack_o/',
} as const;

export function waLink(text: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam',
  'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
] as const;
