# Power Wallet Design System

## Color Palette

### Dark Theme
Power Wallet uses a sophisticated dark theme with gold/orange accents to convey premium quality and trust.

### Primary Colors
- **Gold/Amber**: `#F59E0B` - Primary actions, highlights
- **Light Gold**: `#FBB042` - Hover states, lighter accents
- **Dark Gold**: `#D97706` - Pressed states, darker accents

### Secondary Colors
- **Orange**: `#FB923C` - Secondary actions, gradients
- **Light Orange**: `#FDBA74` - Lighter variations
- **Dark Orange**: `#EA580C` - Darker variations

### Background Colors
- **Deep Black**: `#0F0F0F` - Main background
- **Dark Gray**: `#1A1A1A` - Cards, navigation, elevated surfaces
- **Border Gray**: `#2D2D2D` - Dividers, borders

### Text Colors
- **Primary Text**: `#FFFFFF` - White, main text
- **Secondary Text**: `#D1D5DB` - Light gray, supporting text

## Gradients

### Primary Gradient (Gold to Orange)
```css
background: linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)
```
Used for:
- Primary buttons
- CTAs
- Brand text (Power Wallet logo)

### Background Gradients
```css
/* Hero sections */
background: linear-gradient(135deg, #1A1A1A 0%, #2D1B0E 50%, #1A1A1A 100%)

/* With radial overlay */
background: radial-gradient(circle at 30% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)
```

## Shadows

### Gold Glow Effect
```css
/* Normal */
box-shadow: 0 4px 14px 0 rgba(245, 158, 11, 0.39)

/* Hover */
box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5)
```

### Card Shadow
```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4)
```

## Typography

### Font Family
```
Inter, system-ui, Avenir, Helvetica, Arial, sans-serif
```

### Headings
- All headings: White (`#FFFFFF`)
- Font weights: 600-700

## Components

### Buttons
- **Primary**: Gold gradient with glow effect
- **Outlined**: Gold border, transparent background
- **Text**: Gold text

### Cards
- Background: `#1A1A1A`
- Border: `1px solid #2D2D2D`
- Dark shadow for depth

### Navigation
- Background: `#1A1A1A`
- Border bottom: `#2D2D2D`
- Logo: Gold gradient text

### Modals/Dialogs
- Background: `#1A1A1A`
- Borders: `#2D2D2D`

## Visual Hierarchy

1. **Gold/Orange**: Primary actions, CTAs, important elements
2. **White**: Main text, headings
3. **Light Gray**: Secondary text, descriptions
4. **Dark Gray**: Surfaces, cards, elevated content
5. **Deep Black**: Main background

## Accessibility

- High contrast between text and backgrounds
- Gold colors chosen for visibility against dark backgrounds
- Minimum 4.5:1 contrast ratio for text
- Glow effects provide additional visual feedback

## Brand Identity

The gold/orange theme conveys:
- 💰 **Wealth & Prosperity**: Gold traditionally represents value
- 🔥 **Energy & Action**: Orange suggests activity and dynamism  
- 🌟 **Premium Quality**: Dark theme with gold accents feels luxurious
- 🛡️ **Trust & Stability**: Professional, sophisticated appearance
