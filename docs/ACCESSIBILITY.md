# Accessibility Guidelines

## WCAG AA Compliance

### Color & Contrast
- **Minimum Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Color Independence**: Information not conveyed by color alone
- **Focus Indicators**: Clear visual focus indicators for all interactive elements

### Keyboard Navigation
- **Tab Order**: Logical tab sequence through all interactive elements
- **Skip Links**: Skip to main content for screen reader users
- **Keyboard Shortcuts**: Standard shortcuts (Enter, Space, Escape) work as expected

### Screen Reader Support
- **ARIA Labels**: Descriptive labels for all interactive elements
- **Live Regions**: Progress updates announced to screen readers
- **Semantic HTML**: Proper heading structure and landmark elements

## Implementation Details

### Keyboard Flows

#### Main Navigation
```
Tab: Drop Zone → Export Mode → Destination → Start Button
Shift+Tab: Reverse navigation
Enter/Space: Activate focused element
Escape: Close modals/cancel operations
```

#### Drop Zone
- **Focusable**: Drop zone receives keyboard focus
- **Enter Key**: Opens file picker dialog
- **Screen Reader**: "Drop zone, press Enter to select files"

#### Progress Updates
- **Live Region**: `<div role="status" aria-live="polite">`
- **Updates**: "Export progress: 45% complete, 234 files saved"
- **Frequency**: Updates every 5% or significant state changes

### ARIA Implementation

#### Progress Bar
```html
<div role="progressbar" 
     aria-valuenow="45" 
     aria-valuemin="0" 
     aria-valuemax="100"
     aria-label="Export progress">
  <div class="progress-fill" style="width: 45%"></div>
</div>
```

#### File Drop Zone
```html
<div role="button" 
     tabindex="0"
     aria-label="Drop zone for Snapchat export files"
     onKeyDown={handleKeyDown}>
  <span aria-hidden="true">📁</span>
  <span>Drop your Snapchat export ZIP files here</span>
</div>
```

#### Status Messages
```html
<div role="status" 
     aria-live="polite" 
     aria-atomic="true">
  {statusMessage}
</div>
```

### Visual Design

#### Focus Indicators
```css
.focusable:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 4px;
}
```

#### High Contrast Mode
```css
@media (prefers-contrast: high) {
  .progress-bar {
    border: 2px solid currentColor;
  }
  
  .button {
    border: 2px solid currentColor;
  }
}
```

#### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .progress-bar {
    transition: none;
  }
  
  .fade-in {
    animation: none;
  }
}
```

## Component-Specific Accessibility

### DropZone Component
- **Keyboard Accessible**: Focusable with Enter key activation
- **Drag & Drop**: Works with keyboard navigation
- **Error States**: Clear error messages with ARIA attributes
- **Loading States**: Loading indicators with appropriate labels

### ProgressBar Component
- **Live Updates**: Progress changes announced to screen readers
- **Current File**: Currently processing file announced
- **ETA Information**: Time estimates provided in accessible format
- **Pause/Resume**: Keyboard accessible controls

### Summary Component
- **Data Tables**: Proper table headers and captions
- **Charts/Graphs**: Alternative text descriptions
- **Risk Timeline**: Color-coded with text alternatives
- **Export Options**: Clear labels and descriptions

### DestinationPicker Component
- **Radio Groups**: Proper grouping with fieldset/legend
- **File System Access**: Clear explanation of permissions
- **Fallback Options**: Alternative methods clearly explained
- **Error Handling**: Accessible error messages

## Testing & Validation

### Automated Testing
- **Axe Core**: Automated accessibility testing in CI
- **Lighthouse**: Accessibility audit in build process
- **Jest-Axe**: Unit test accessibility violations

### Manual Testing
- **Keyboard Only**: Complete user flows using only keyboard
- **Screen Reader**: Test with NVDA, JAWS, VoiceOver
- **High Contrast**: Test in high contrast mode
- **Zoom**: Test at 200% zoom level

### User Testing
- **Disability Community**: Feedback from users with disabilities
- **Assistive Technology**: Testing with various AT tools
- **Real-World Usage**: Testing with actual users and workflows

## Accessibility Checklist

### ✅ Perceivable
- [ ] All text has sufficient color contrast
- [ ] Information not conveyed by color alone
- [ ] Text can be resized up to 200% without loss of functionality
- [ ] Images have appropriate alt text
- [ ] Audio/video content has captions/transcripts

### ✅ Operable
- [ ] All functionality available from keyboard
- [ ] No content causes seizures (flashing)
- [ ] Users can pause/stop moving content
- [ ] Clear navigation and orientation
- [ ] Sufficient time limits with ability to extend

### ✅ Understandable
- [ ] Text is readable and understandable
- [ ] Content appears and operates in predictable ways
- [ ] Users are helped to avoid and correct mistakes
- [ ] Clear error messages and recovery instructions

### ✅ Robust
- [ ] Compatible with assistive technologies
- [ ] Valid HTML and proper ARIA usage
- [ ] Future-proof markup and code
- [ ] Graceful degradation for older browsers

## Implementation Priority

### Phase 1 (Critical)
- Basic keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus indicators

### Phase 2 (Important)
- ARIA live regions for progress
- High contrast mode support
- Reduced motion preferences
- Error message accessibility

### Phase 3 (Enhancement)
- Advanced keyboard shortcuts
- Custom screen reader announcements
- Voice control compatibility
- Advanced AT integration
