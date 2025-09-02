#!/usr/bin/env node

/**
 * Script to update all section files to use the new LoadingSection wrapper
 * Run this with: node update-sections.js
 */

const fs = require('fs');
const path = require('path');

const sectionsDir = path.join(__dirname, 'src', 'sections');

// Sections to update (excluding ones already updated)
const sectionsToUpdate = [
  'PersonalizationSection.jsx',
  'CommandsSection.jsx',
  'moderation/index.jsx',
  'games-socials/index.jsx'
];

// Mapping of loading props for each section
const loadingPropsMap = {
  'PersonalizationSection.jsx': {
    loadingVar: 'personalizationLoading',
    title: 'Loading Personalization Settings',
    message: 'Fetching your server\'s personalization configuration...'
  },
  'CommandsSection.jsx': {
    loadingVar: 'commandsLoading',
    title: 'Loading Commands Settings',
    message: 'Fetching command configuration and permissions...'
  },
  'moderation/index.jsx': {
    loadingVar: 'moderationLoading',
    title: 'Loading Moderation Settings',
    message: 'Fetching your server configuration and permissions...'
  },
  'games-socials/index.jsx': {
    loadingVar: 'gamesSocialsLoading',
    title: 'Loading Games & Socials',
    message: 'Fetching social platform configurations...'
  }
};

function updateSection(sectionFile) {
  const filePath = path.join(sectionsDir, sectionFile);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${sectionFile}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const config = loadingPropsMap[sectionFile];
  
  if (!config) {
    console.log(`❌ No config found for: ${sectionFile}`);
    return;
  }

  // 1. Update import
  content = content.replace(
    /import LoadingOverlay from ['"][^'"]*LoadingOverlay['"];?/,
    "import LoadingSection from '../components/LoadingSection';"
  );

  // 2. Find the return statement and main div
  const returnMatch = content.match(/return\s*<div([^>]*)>/);
  if (!returnMatch) {
    console.log(`❌ Could not find return div in: ${sectionFile}`);
    return;
  }

  const divAttributes = returnMatch[1];
  
  // 3. Replace return div with LoadingSection
  content = content.replace(
    /return\s*<div([^>]*)>/,
    `return (
    <LoadingSection
      loading={${config.loadingVar}}
      title="${config.title}"
      message="${config.message}"
      className="${divAttributes.includes('className') ? divAttributes.match(/className=['"]([^'"]*)['"]/)?.[1] || '' : ''}"
    >`
  );

  // 4. Remove any existing LoadingOverlay components
  content = content.replace(
    /\s*{\s*\w+Loading\s*&&\s*\(\s*<LoadingOverlay[^}]*\/>\s*\)\s*}/g,
    ''
  );

  // 5. Fix the closing div
  content = content.replace(/\s*<\/div>\s*;\s*}$/, '\n    </LoadingSection>\n  );\n}');

  // Write the updated content
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated: ${sectionFile}`);
}

console.log('🔄 Updating section files to use LoadingSection...\n');

sectionsToUpdate.forEach(updateSection);

console.log('\n✅ Section update complete!');
console.log('\n📝 Manual steps required:');
console.log('1. Check each updated file for any remaining LoadingOverlay imports');
console.log('2. Verify the loading variable names match your actual props');
console.log('3. Test each section to ensure loading works correctly');
console.log('4. Update any missed LoadingOverlay components within card bodies');
