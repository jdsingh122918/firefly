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
    color: "#dc2626", // red-600
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
    color: "#7c3aed", // violet-600
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
    color: "#059669", // emerald-600
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
    color: "#2563eb", // blue-600
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
    color: "#ea580c", // orange-600
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
    color: "#16a34a", // green-600
    icon: "💰",
    tags: [
      "Finances & Insurance"
    ]
  },
  {
    name: "Legal & Advocacy",
    description: "Legal services, advocacy, and protective services",
    color: "#0891b2", // cyan-600
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
    color: "#7c2d12", // amber-800
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
 * Color palette for healthcare categories
 */
export const HEALTHCARE_COLORS = {
  MEDICAL: "#dc2626",        // red-600
  MENTAL_HEALTH: "#7c3aed",  // violet-600
  HOME_CARE: "#059669",      // emerald-600
  EQUIPMENT: "#2563eb",      // blue-600
  BASIC_NEEDS: "#ea580c",    // orange-600
  FINANCIAL: "#16a34a",      // green-600
  LEGAL: "#0891b2",          // cyan-600
  EDUCATION: "#7c2d12"       // amber-800
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