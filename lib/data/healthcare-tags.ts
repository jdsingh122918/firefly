/**
 * Comprehensive Healthcare Service Tags Configuration
 *
 * This file defines the predefined system tags and categories that are automatically
 * available in the Firefly End of Life Care Platform. These tags help organize
 * and categorize healthcare services, resources, and care management activities.
 */

export interface HealthcareCategory {
  name: string;
  description: string;
  color: string;
  icon: string;
  tags: string[];
}

export const HEALTHCARE_CATEGORIES: HealthcareCategory[] = [
  {
    name: "Medical & Healthcare Services",
    description: "Core medical services and healthcare professionals",
    color: "#DF4661", // PPCC Pink
    icon: "🏥",
    tags: [
      "Doctors/Physicians",
      "Hospital & Medical Facilities",
      "Medical Procedures, Tests & Surgery",
      "Medications/Pharmacy",
      "Wound Care",
      "Pain & Symptom Management",
      "Diagnosis/Disease Specific",
      "Palliative & Hospice Care",
      "Emergency Care",
      "Medical Decision-Making",
      "Diagnosis/Disease-Specific resources",
      "Rehabilitation Therapy"
    ]
  },
  {
    name: "Mental Health & Supportive Programs",
    description: "Mental health, behavioral support, and therapeutic programs",
    color: "#C964CF", // PPCC Purple
    icon: "🧠",
    tags: [
      "Mental Health & Wellness",
      "Behavioral Support",
      "Grief/Bereavement Support",
      "Psychosocial Care & Creative Arts Therapy",
      "Sibling Support",
      "Crisis Care",
      "Camps",
      "Recreation",
      "Wish Granting Organizations"
    ]
  },
  {
    name: "Home & Community-Based Care",
    description: "Home healthcare services and community-based support",
    color: "#00B2A9", // PPCC Teal
    icon: "🏠",
    tags: [
      "Home Healthcare",
      "Case Management/Care Coordination",
      "Respite Care",
      "Home Modifications & Accessibility",
      "Medical Equipment & Supportive Technology"
    ]
  },
  {
    name: "Medical Supplies & Equipment",
    description: "Medical devices, adaptive equipment, and technology",
    color: "#418FDE", // PPCC Blue
    icon: "🔧",
    tags: [
      "Medical Supplies & Equipment",
      "Adaptive Care Equipment & Technology",
      "Communication Devices"
    ]
  },
  {
    name: "Basic Needs & Daily Living",
    description: "Essential daily living support and basic needs",
    color: "#FF8200", // PPCC Orange (Primary)
    icon: "🛡️",
    tags: [
      "Basic Human Needs (Food, Clothing, Housing, Goods)",
      "Transportation",
      "Nutrition & Feeding"
    ]
  },
  {
    name: "Finances & Insurance",
    description: "Financial assistance, insurance, and billing support",
    color: "#00B2A9", // PPCC Teal (alternative shade)
    icon: "💰",
    tags: [
      "Finances & Insurance"
    ]
  },
  {
    name: "Legal & Advocacy",
    description: "Legal services, advocacy, and protective services",
    color: "#333333", // PPCC Gray
    icon: "⚖️",
    tags: [
      "Advocacy",
      "Legal Aid",
      "Adoption, Foster Care & CYF"
    ]
  },
  {
    name: "Education & Employment",
    description: "Educational services and employment support",
    color: "#418FDE", // PPCC Blue (alternative usage)
    icon: "📚",
    tags: [
      "Education",
      "Employment",
      "Early Intervention/Developmental Services"
    ]
  }
];

/**
 * Flattened list of all healthcare tags for easy access
 */
export const ALL_HEALTHCARE_TAGS = HEALTHCARE_CATEGORIES.flatMap(category =>
  category.tags.map(tag => ({
    name: tag,
    category: category.name,
    description: `Healthcare service related to ${category.description.toLowerCase()}`,
    color: category.color
  }))
);

/**
 * Color palette for healthcare categories - PPCC Brand Colors
 */
export const HEALTHCARE_COLORS = {
  MEDICAL: "#DF4661",        // PPCC Pink
  MENTAL_HEALTH: "#C964CF",  // PPCC Purple
  HOME_CARE: "#00B2A9",      // PPCC Teal
  EQUIPMENT: "#418FDE",      // PPCC Blue
  BASIC_NEEDS: "#FF8200",    // PPCC Orange (Primary)
  FINANCIAL: "#00B2A9",      // PPCC Teal (alternative)
  LEGAL: "#333333",          // PPCC Gray
  EDUCATION: "#418FDE"       // PPCC Blue (alternative)
} as const;

/**
 * Icons for healthcare categories
 */
export const HEALTHCARE_ICONS = {
  MEDICAL: "🏥",
  MENTAL_HEALTH: "🧠",
  HOME_CARE: "🏠",
  EQUIPMENT: "🔧",
  BASIC_NEEDS: "🛡️",
  FINANCIAL: "💰",
  LEGAL: "⚖️",
  EDUCATION: "📚"
} as const;