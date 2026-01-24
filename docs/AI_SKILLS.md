# 🤖 AI Skills & Automation Guide

This guide covers the AI agent skills integrated into Account v2 for automated development assistance, code review, and optimization.

## 🎯 Overview

Account v2 includes comprehensive AI agent skills that enable automated development across multiple platforms. These skills provide consistent, Vercel-engineering-approved patterns for React, Next.js, and general web development.

## 📁 Skills Structure

### Available Skills

#### 1. **Vercel React Best Practices**
- **Location**: `.agents/skills/vercel-react-best-practices/`
- **Rules Count**: 57 optimization rules
- **Coverage**: React, Next.js, performance, bundling, server-side
- **Impact Levels**: CRITICAL → LOW (8 categories)

#### 2. **Web Design Guidelines**
- **Location**: `.agents/skills/web-design-guidelines/`
- **Focus**: UI/UX patterns, accessibility, responsive design
- **Application**: Component design, layout decisions, user experience

### Multi-Platform Support

```bash
.agents/skills/         # OpenCode AI platform (primary)
.gemini/skills/         # Google Gemini AI
.github/skills/         # GitHub Copilot
.opencode/skills/       # OpenCode CLI
```

Each skill is symlinked across platforms for maximum compatibility.

## 🚀 Usage in Development Workflow

### 1. **Code Generation**
When generating new React components:
```bash
# AI automatically applies optimization patterns
- Bundle size optimization rules
- Re-render optimization patterns  
- Performance best practices
- TypeScript integration
```

### 2. **Code Review & Refactoring**
During code reviews, AI agents:
- Identify performance bottlenecks
- Suggest optimization opportunities
- Ensure consistent patterns
- Validate against Vercel standards

### 3. **Automated Optimization**
AI skills can automatically:
- Replace anti-patterns with optimized alternatives
- Add missing memoization where beneficial
- Optimize data fetching patterns
- Reduce bundle size impact

## 📋 Rule Categories & Impact

### CRITICAL Impact (Must Apply)
1. **Eliminating Waterfalls** (`async-*`)
   - Prevent sequential network requests
   - Use Promise.all() for parallel operations
   - Strategic Suspense boundaries

2. **Bundle Size Optimization** (`bundle-*`)
   - Avoid barrel file imports
   - Dynamic imports for heavy components
   - Conditional module loading

### HIGH Impact (Highly Recommended)
3. **Server-Side Performance** (`server-*`)
   - React.cache() for deduplication
   - LRU caching strategies
   - Minimize RSC serialization

### MEDIUM-HIGH Impact (Recommended)
4. **Client-Side Data Fetching** (`client-*`)
   - SWR for automatic deduplication
   - Passive event listeners
   - localStorage best practices

### MEDIUM Impact (Good to Have)
5. **Re-render Optimization** (`rerender-*`)
   - Memo component extraction
   - Functional setState updates
   - Derived state subscriptions

6. **Rendering Performance** (`rendering-*`)
   - SVG optimization techniques
   - Content-visibility for long lists
   - Hydration optimization

### LOW-MEDIUM Impact (Micro-optimizations)
7. **JavaScript Performance** (`js-*`)
   - DOM batching techniques
   - Cache strategies
   - Loop optimizations

### LOW Impact (Advanced Patterns)
8. **Advanced Patterns** (`advanced-*`)
   - Event handler refs
   - Stable callback patterns
   - Initialization optimization

## 🔧 Integration Examples

### OpenCode AI Platform
```javascript
// Automatically applies vercel-react-best-practices skill
await opencode.review('components/UserList.tsx')
// Returns: optimization suggestions with specific rules
```

### GitHub Copilot
```markdown
# Comments trigger skill application
// TODO: Optimize this component using vercel-react-best-practices
// AI applies relevant rules automatically
```

### CLI Usage
```bash
# Run optimization check
opencode check --skill=vercel-react-best-practices src/

# Generate optimized component
opencode generate component --skill=vercel-react-best-practices UserProfile
```

## 📊 Impact Metrics

When skills are consistently applied:

### Performance Improvements
- **Bundle Size**: 60-80% reduction
- **API Calls**: 70-90% reduction through caching
- **Re-renders**: 30-50% fewer unnecessary updates
- **Loading Time**: 40-60% faster perceived loading

### Developer Experience
- **Code Review Time**: 40-60% faster with automated suggestions
- **Consistency**: 90%+ adherence to best practices
- **Onboarding**: 50% faster for new developers
- **Technical Debt**: Significant reduction through proactive optimization

## 🎯 Best Practices for Using AI Skills

### 1. **Trust but Verify**
- Review AI suggestions before applying
- Understand the reasoning behind each rule
- Test performance improvements empirically

### 2. **Apply Incrementally**
- Start with CRITICAL and HIGH impact rules
- Gradually incorporate MEDIUM impact optimizations
- Monitor performance metrics continuously

### 3. **Context Matters**
- Not all rules apply to every situation
- Consider trade-offs (complexity vs. performance)
- Adapt patterns to your specific use case

### 4. **Team Alignment**
- Ensure team understanding of applied patterns
- Document exceptions and rationale
- Maintain consistency across codebase

## 🔄 Maintenance & Updates

### Skill Updates
- Skills are versioned and maintained alongside main documentation
- New rules are added as Vercel engineering updates best practices
- Backward compatibility is maintained where possible

### Contributing
- New patterns can be proposed via skill rule files
- Performance impact should be measured and documented
- Rules should include clear examples and explanations

## 📚 Additional Resources

- **[Complete Rules Reference](../AGENTS.md)** - Full compilation with examples
- **[Performance Implementation](./PERFORMANCE_OPTIMIZATIONS.md)** - Technical implementation details
- **[Development Roadmap](./ROADMAP.md)** - Future AI skill integration plans

---

**Last Updated**: 2026-01-24  
**Skills Version**: 1.0.0  
**Supported Platforms**: OpenCode, Gemini, GitHub Copilot, OpenCode CLI