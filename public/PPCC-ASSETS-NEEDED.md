# PPCC Brand Assets Required

To complete the PPCC brand implementation, the following assets are needed:

## Logo Assets (Required)
- **`ppcc-logo-black.svg`** - PPCC dragonfly logo in black (1-color version)
  - Minimum width: 144px (1.5" at 96dpi)
  - SVG format preferred for crisp scaling
  - Used in light mode across dashboard and auth pages

- **`ppcc-logo-white.svg`** - PPCC dragonfly logo in white (1-color reversed)
  - Same dimensions as black version
  - SVG format preferred
  - Used in dark mode across dashboard and auth pages

## Hero Image (Required)
- **`ppcc-hero.jpg`** - High-resolution background image for authentication pages
  - Recommended size: 1920x1080px or higher
  - Should represent PPCC's mission and values
  - Will be overlaid with dark gradient for text readability

## Brand Guidelines Compliance
- All logos meet PPCC brand guidelines requirements:
  - Minimum 0.25" (24px) white space clearance (implemented via CSS padding)
  - Proper aspect ratios maintained with `object-contain`
  - Theme-aware switching between black and white versions

## Current Asset Status
- ⚠️ `ppcc-logo-black.svg` - **DEVELOPMENT PLACEHOLDER ACTIVE**
- ⚠️ `ppcc-logo-white.svg` - **DEVELOPMENT PLACEHOLDER ACTIVE**
- ⚠️ `ppcc-hero-placeholder.svg` - **DEVELOPMENT PLACEHOLDER ACTIVE**

## Development Placeholders Working
✅ **All placeholder assets are functional and properly sized**
- Logo placeholders use correct PPCC colors and proportions
- Hero placeholder uses PPCC color gradient
- All clearly labeled as development placeholders
- Ready for immediate replacement with official assets

## Ready for Production Assets
When official PPCC assets are obtained:
1. Replace `ppcc-logo-black.svg` with official black logo
2. Replace `ppcc-logo-white.svg` with official white logo
3. Replace `ppcc-hero-placeholder.svg` with official hero image (`ppcc-hero.jpg`)
4. Update auth layout if changing from SVG to JPG format

**No code changes needed** - just asset file replacement!