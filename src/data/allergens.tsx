import type { ReactNode } from 'react';
import { LuWheat, LuEgg, LuFish, LuNut, LuBean, LuMilk, LuTreeDeciduous, LuLeafyGreen, LuFlower2, LuCircleDot, LuWine, LuFlower, LuSnail } from 'react-icons/lu';
import type { AllergenId } from '../types';

function Shrimp() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 12h10a8 8 0 0 0-8-8H9a5 5 0 0 0 0 10h1" />
      <path d="M10 14a4 4 0 0 0 4 4h1" />
      <path d="M5 19l2-2 2 2" />
      <path d="M17 8h.01" />
    </svg>
  );
}

export const ALLERGENS: { id: AllergenId; label: string; icon: ReactNode }[] = [
  { id: 'gluten', label: 'Glúten', icon: <LuWheat aria-hidden /> },
  { id: 'crustaceos', label: 'Crustáceos', icon: <Shrimp /> },
  { id: 'ovos', label: 'Ovos', icon: <LuEgg aria-hidden /> },
  { id: 'peixe', label: 'Peixe', icon: <LuFish aria-hidden /> },
  { id: 'amendoins', label: 'Amendoins', icon: <LuNut aria-hidden /> },
  { id: 'soja', label: 'Soja', icon: <LuBean aria-hidden /> },
  { id: 'leite', label: 'Leite', icon: <LuMilk aria-hidden /> },
  { id: 'frutos_casca_rija', label: 'Frutos de casca rija', icon: <LuTreeDeciduous aria-hidden /> },
  { id: 'aipo', label: 'Aipo', icon: <LuLeafyGreen aria-hidden /> },
  { id: 'mostarda', label: 'Mostarda', icon: <LuFlower2 aria-hidden /> },
  { id: 'sesamo', label: 'Sésamo', icon: <LuCircleDot aria-hidden /> },
  { id: 'sulfitos', label: 'Sulfitos', icon: <LuWine aria-hidden /> },
  { id: 'tremoco', label: 'Tremoço', icon: <LuFlower aria-hidden /> },
  { id: 'moluscos', label: 'Moluscos', icon: <LuSnail aria-hidden /> },
];

export function allergenLabel(id: AllergenId) {
  return ALLERGENS.find((a) => a.id === id)?.label ?? id;
}
