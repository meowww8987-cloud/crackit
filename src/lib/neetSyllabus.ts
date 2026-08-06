// NEET 2027 Complete Syllabus Data
// Pre-defined chapters and default lecture breakdowns for all 5 subjects
// Users select from this data instead of typing — eliminates typos and duplicates

import type { Subject } from './types';

export interface NEETLecture {
  lecNo: number;
  topic: string;
}

export interface NEETChapter {
  id: string; // stable ID like "phy-01"
  name: string;
  category?: string; // e.g., "Class 11", "Class 12", "Physical", "Organic", etc.
  lectures: NEETLecture[];
  weightage?: number; // NEET marks (typically 2-12)
}

export interface NEETSubject {
  subject: Subject;
  chapters: NEETChapter[];
}

// Helper to generate default lectures (L1-L5 with placeholder topics)
function defaultLectures(count: number, prefix: string = ''): NEETLecture[] {
  return Array.from({ length: count }, (_, i) => ({
    lecNo: i + 1,
    topic: prefix ? `${prefix} - Part ${i + 1}` : `Lecture ${i + 1}`,
  }));
}

export const NEET_SYLLABUS: NEETSubject[] = [
  // ===== PHYSICS =====
  {
    subject: 'Physics',
    chapters: [
      // Class 11
      { id: 'phy-01', name: 'Physical World & Measurement', category: 'Class 11', lectures: defaultLectures(3, 'Basics') },
      { id: 'phy-02', name: 'Units and Measurements', category: 'Class 11', lectures: defaultLectures(4, 'Units') },
      { id: 'phy-03', name: 'Motion in a Straight Line', category: 'Class 11', lectures: defaultLectures(4, 'Motion') },
      { id: 'phy-04', name: 'Motion in a Plane', category: 'Class 11', lectures: defaultLectures(5, 'Vectors') },
      { id: 'phy-05', name: 'Laws of Motion', category: 'Class 11', lectures: defaultLectures(5, 'Newton Laws') },
      { id: 'phy-06', name: 'Work, Energy and Power', category: 'Class 11', lectures: defaultLectures(4, 'Work-Energy') },
      { id: 'phy-07', name: 'System of Particles & Rotational Motion', category: 'Class 11', lectures: defaultLectures(6, 'Rotation') },
      { id: 'phy-08', name: 'Gravitation', category: 'Class 11', lectures: defaultLectures(4, 'Gravitation') },
      { id: 'phy-09', name: 'Mechanical Properties of Solids', category: 'Class 11', lectures: defaultLectures(3, 'Elasticity') },
      { id: 'phy-10', name: 'Mechanical Properties of Fluids', category: 'Class 11', lectures: defaultLectures(5, 'Fluids') },
      { id: 'phy-11', name: 'Thermal Properties of Matter', category: 'Class 11', lectures: defaultLectures(4, 'Thermal') },
      { id: 'phy-12', name: 'Thermodynamics', category: 'Class 11', lectures: defaultLectures(5, 'Thermo') },
      { id: 'phy-13', name: 'Kinetic Theory of Gases', category: 'Class 11', lectures: defaultLectures(3, 'KTG') },
      { id: 'phy-14', name: 'Oscillations', category: 'Class 11', lectures: defaultLectures(5, 'SHM') },
      { id: 'phy-15', name: 'Waves', category: 'Class 11', lectures: defaultLectures(5, 'Waves') },
      // Class 12
      { id: 'phy-16', name: 'Electric Charges and Fields', category: 'Class 12', lectures: defaultLectures(5, 'Charges') },
      { id: 'phy-17', name: 'Electrostatic Potential and Capacitance', category: 'Class 12', lectures: defaultLectures(5, 'Potential') },
      { id: 'phy-18', name: 'Current Electricity', category: 'Class 12', lectures: defaultLectures(6, 'Current') },
      { id: 'phy-19', name: 'Moving Charges and Magnetism', category: 'Class 12', lectures: defaultLectures(6, 'Magnetism') },
      { id: 'phy-20', name: 'Magnetism and Matter', category: 'Class 12', lectures: defaultLectures(3, 'Magnetism') },
      { id: 'phy-21', name: 'Electromagnetic Induction', category: 'Class 12', lectures: defaultLectures(4, 'EMI') },
      { id: 'phy-22', name: 'Alternating Current', category: 'Class 12', lectures: defaultLectures(4, 'AC') },
      { id: 'phy-23', name: 'Electromagnetic Waves', category: 'Class 12', lectures: defaultLectures(2, 'EM Waves') },
      { id: 'phy-24', name: 'Ray Optics and Optical Instruments', category: 'Class 12', lectures: defaultLectures(6, 'Ray Optics') },
      { id: 'phy-25', name: 'Wave Optics', category: 'Class 12', lectures: defaultLectures(5, 'Wave Optics') },
      { id: 'phy-26', name: 'Dual Nature of Radiation and Matter', category: 'Class 12', lectures: defaultLectures(4, 'Dual Nature') },
      { id: 'phy-27', name: 'Atoms', category: 'Class 12', lectures: defaultLectures(3, 'Atoms') },
      { id: 'phy-28', name: 'Nuclei', category: 'Class 12', lectures: defaultLectures(4, 'Nuclei') },
      { id: 'phy-29', name: 'Semiconductor Electronics', category: 'Class 12', lectures: defaultLectures(5, 'Semiconductor') },
    ],
  },

  // ===== CHEMISTRY =====
  {
    subject: 'Chemistry',
    chapters: [
      // Physical Chemistry
      { id: 'chem-01', name: 'Some Basic Concepts of Chemistry', category: 'Physical', lectures: defaultLectures(4, 'Mole Concept') },
      { id: 'chem-02', name: 'Structure of Atom', category: 'Physical', lectures: defaultLectures(5, 'Atomic Structure') },
      { id: 'chem-03', name: 'Classification of Elements and Periodicity', category: 'Physical', lectures: defaultLectures(3, 'Periodic') },
      { id: 'chem-04', name: 'Chemical Bonding and Molecular Structure', category: 'Physical', lectures: defaultLectures(6, 'Bonding') },
      { id: 'chem-05', name: 'States of Matter', category: 'Physical', lectures: defaultLectures(4, 'Gases') },
      { id: 'chem-06', name: 'Thermodynamics', category: 'Physical', lectures: defaultLectures(5, 'Thermo') },
      { id: 'chem-07', name: 'Equilibrium', category: 'Physical', lectures: defaultLectures(5, 'Equilibrium') },
      { id: 'chem-08', name: 'Redox Reactions', category: 'Physical', lectures: defaultLectures(3, 'Redox') },
      { id: 'chem-09', name: 'Hydrogen', category: 'Physical', lectures: defaultLectures(2, 'Hydrogen') },
      { id: 'chem-10', name: 'The s-Block Elements', category: 'Physical', lectures: defaultLectures(3, 's-Block') },
      { id: 'chem-11', name: 'The p-Block Elements', category: 'Physical', lectures: defaultLectures(5, 'p-Block') },
      { id: 'chem-12', name: 'Solutions', category: 'Physical', lectures: defaultLectures(4, 'Solutions') },
      { id: 'chem-13', name: 'Electrochemistry', category: 'Physical', lectures: defaultLectures(5, 'Electrochem') },
      { id: 'chem-14', name: 'Chemical Kinetics', category: 'Physical', lectures: defaultLectures(4, 'Kinetics') },
      { id: 'chem-15', name: 'Surface Chemistry', category: 'Physical', lectures: defaultLectures(3, 'Surface') },
      { id: 'chem-16', name: 'General Principles of Isolation of Elements', category: 'Physical', lectures: defaultLectures(3, 'Metallurgy') },
      // Organic Chemistry
      { id: 'chem-17', name: 'Purification and Characterisation', category: 'Organic', lectures: defaultLectures(3, 'Purification') },
      { id: 'chem-18', name: 'Some Basic Principles of Organic Chemistry', category: 'Organic', lectures: defaultLectures(6, 'GOC') },
      { id: 'chem-19', name: 'Hydrocarbons', category: 'Organic', lectures: defaultLectures(5, 'Hydrocarbons') },
      { id: 'chem-20', name: 'Haloalkanes and Haloarenes', category: 'Organic', lectures: defaultLectures(4, 'Halo') },
      { id: 'chem-21', name: 'Alcohols, Phenols and Ethers', category: 'Organic', lectures: defaultLectures(5, 'Alcohols') },
      { id: 'chem-22', name: 'Aldehydes, Ketones and Carboxylic Acids', category: 'Organic', lectures: defaultLectures(5, 'Carbonyl') },
      { id: 'chem-23', name: 'Amines', category: 'Organic', lectures: defaultLectures(4, 'Amines') },
      { id: 'chem-24', name: 'Biomolecules', category: 'Organic', lectures: defaultLectures(4, 'Biomolecules') },
      // Inorganic Chemistry
      { id: 'chem-25', name: 'The d- and f-Block Elements', category: 'Inorganic', lectures: defaultLectures(4, 'd-f Block') },
      { id: 'chem-26', name: 'Coordination Compounds', category: 'Inorganic', lectures: defaultLectures(5, 'Coordination') },
      { id: 'chem-27', name: 'Chemistry in Everyday Life', category: 'Inorganic', lectures: defaultLectures(3, 'Everyday') },
    ],
  },

  // ===== BOTANY =====
  {
    subject: 'Botany',
    chapters: [
      // Diversity in Living World
      { id: 'bot-01', name: 'The Living World', category: 'Diversity', lectures: defaultLectures(3, 'Living World') },
      { id: 'bot-02', name: 'Biological Classification', category: 'Diversity', lectures: defaultLectures(4, 'Classification') },
      { id: 'bot-03', name: 'Plant Kingdom', category: 'Diversity', lectures: defaultLectures(5, 'Plant Kingdom') },
      // Structural Organisation
      { id: 'bot-04', name: 'Morphology of Flowering Plants', category: 'Structural', lectures: defaultLectures(5, 'Morphology') },
      { id: 'bot-05', name: 'Anatomy of Flowering Plants', category: 'Structural', lectures: defaultLectures(4, 'Anatomy') },
      { id: 'bot-06', name: 'Structural Organisation in Animals', category: 'Structural', lectures: defaultLectures(3, 'Animal Tissue') },
      // Cell Structure & Function
      { id: 'bot-07', name: 'Cell - The Unit of Life', category: 'Cell', lectures: defaultLectures(5, 'Cell') },
      { id: 'bot-08', name: 'Biomolecules', category: 'Cell', lectures: defaultLectures(5, 'Biomolecules') },
      { id: 'bot-09', name: 'Cell Cycle and Cell Division', category: 'Cell', lectures: defaultLectures(4, 'Cell Cycle') },
      // Plant Physiology
      { id: 'bot-10', name: 'Photosynthesis in Higher Plants', category: 'Physiology', lectures: defaultLectures(5, 'Photosynthesis') },
      { id: 'bot-11', name: 'Respiration in Plants', category: 'Physiology', lectures: defaultLectures(4, 'Respiration') },
      { id: 'bot-12', name: 'Plant Growth and Development', category: 'Physiology', lectures: defaultLectures(4, 'Plant Growth') },
      // Biology in Human Welfare
      { id: 'bot-13', name: 'Microbes in Human Welfare', category: 'Human Welfare', lectures: defaultLectures(3, 'Microbes') },
    ],
  },

  // ===== ZOOLOGY =====
  {
    subject: 'Zoology',
    chapters: [
      // Human Physiology
      { id: 'zoo-01', name: 'Digestion and Absorption', category: 'Physiology', lectures: defaultLectures(4, 'Digestion') },
      { id: 'zoo-02', name: 'Breathing and Exchange of Gases', category: 'Physiology', lectures: defaultLectures(4, 'Breathing') },
      { id: 'zoo-03', name: 'Body Fluids and Circulation', category: 'Physiology', lectures: defaultLectures(5, 'Circulation') },
      { id: 'zoo-04', name: 'Excretory Products and Elimination', category: 'Physiology', lectures: defaultLectures(4, 'Excretion') },
      { id: 'zoo-05', name: 'Locomotion and Movement', category: 'Physiology', lectures: defaultLectures(3, 'Locomotion') },
      { id: 'zoo-06', name: 'Neural Control and Coordination', category: 'Physiology', lectures: defaultLectures(5, 'Neural') },
      { id: 'zoo-07', name: 'Chemical Coordination and Integration', category: 'Physiology', lectures: defaultLectures(5, 'Hormones') },
      // Reproduction
      { id: 'zoo-08', name: 'Reproduction in Organisms', category: 'Reproduction', lectures: defaultLectures(3, 'Reproduction') },
      { id: 'zoo-09', name: 'Sexual Reproduction in Flowering Plants', category: 'Reproduction', lectures: defaultLectures(5, 'Plant Reproduction') },
      { id: 'zoo-10', name: 'Human Reproduction', category: 'Reproduction', lectures: defaultLectures(5, 'Human Repro') },
      { id: 'zoo-11', name: 'Reproductive Health', category: 'Reproduction', lectures: defaultLectures(3, 'Repro Health') },
      // Genetics and Evolution
      { id: 'zoo-12', name: 'Principles of Inheritance and Variation', category: 'Genetics', lectures: defaultLectures(6, 'Genetics') },
      { id: 'zoo-13', name: 'Molecular Basis of Inheritance', category: 'Genetics', lectures: defaultLectures(6, 'DNA') },
      { id: 'zoo-14', name: 'Evolution', category: 'Genetics', lectures: defaultLectures(5, 'Evolution') },
      // Biotechnology
      { id: 'zoo-15', name: 'Biotechnology - Principles and Processes', category: 'Biotech', lectures: defaultLectures(4, 'Biotech') },
      { id: 'zoo-16', name: 'Biotechnology and Its Applications', category: 'Biotech', lectures: defaultLectures(3, 'Biotech App') },
      // Ecology
      { id: 'zoo-17', name: 'Organisms and Populations', category: 'Ecology', lectures: defaultLectures(4, 'Ecology') },
      { id: 'zoo-18', name: 'Ecosystem', category: 'Ecology', lectures: defaultLectures(4, 'Ecosystem') },
      { id: 'zoo-19', name: 'Biodiversity and Conservation', category: 'Ecology', lectures: defaultLectures(3, 'Biodiversity') },
      { id: 'zoo-20', name: 'Environmental Issues', category: 'Ecology', lectures: defaultLectures(3, 'Environment') },
    ],
  },

  // ===== GENERAL (for non-subject study) =====
  {
    subject: 'General',
    chapters: [
      { id: 'gen-01', name: 'Daily Practice Problems', category: 'Practice', lectures: defaultLectures(5, 'DPP') },
      { id: 'gen-02', name: 'Revision Session', category: 'Practice', lectures: defaultLectures(3, 'Revision') },
      { id: 'gen-03', name: 'Mock Test Analysis', category: 'Practice', lectures: defaultLectures(2, 'Analysis') },
      { id: 'gen-04', name: 'Formula Revision', category: 'Practice', lectures: defaultLectures(3, 'Formulas') },
      { id: 'gen-05', name: 'PYQ Practice', category: 'Practice', lectures: defaultLectures(4, 'PYQ') },
    ],
  },
];

// Helper: get chapters for a subject
export function getChaptersForSubject(subject: Subject): NEETChapter[] {
  const subj = NEET_SYLLABUS.find((s) => s.subject === subject);
  if (!subj) return [];
  // Assign weightage based on known high-yield chapters
  const highYield: Record<string, number> = {
    'phy-26': 12, 'phy-27': 8, 'phy-28': 6, // Modern Physics
    'phy-24': 8, 'phy-25': 4, // Optics
    'phy-18': 8, // Current Electricity
    'phy-07': 8, 'phy-05': 4, 'phy-06': 4, // Rotation + Laws + Work
    'phy-16': 4, 'phy-17': 4, 'phy-19': 6, // Electrostatics + Magnetism
    'chem-18': 12, 'chem-19': 8, 'chem-22': 6, 'chem-21': 4, // Organic
    'chem-04': 6, 'chem-07': 6, 'chem-13': 4, 'chem-14': 4, // Physical key
    'chem-25': 4, 'chem-26': 6, // Inorganic
    'bot-10': 8, 'bot-07': 6, 'bot-08': 6, // Photosynthesis + Cell
    'bot-04': 4, 'bot-05': 4, // Structural
    'zoo-01': 4, 'zoo-03': 6, 'zoo-06': 6, 'zoo-07': 6, // Physiology
    'zoo-12': 8, 'zoo-13': 8, // Genetics
    'zoo-17': 4, 'zoo-18': 4, // Ecology
  };
  return subj.chapters.map((ch) => ({
    ...ch,
    weightage: highYield[ch.id] ?? 4,
  }));
}

// Helper: get all subjects
export function getNEETSubjects(): Subject[] {
  return NEET_SYLLABUS.map((s) => s.subject);
}

// Helper: find a chapter by ID
export function findChapterById(id: string): NEETChapter | undefined {
  for (const subj of NEET_SYLLABUS) {
    const ch = subj.chapters.find((c) => c.id === id);
    if (ch) return ch;
  }
  return undefined;
}

// Helper: find which subject a chapter belongs to
export function getSubjectForChapter(chapterId: string): Subject | null {
  for (const subj of NEET_SYLLABUS) {
    if (subj.chapters.some((c) => c.id === chapterId)) {
      return subj.subject;
    }
  }
  return null;
}
