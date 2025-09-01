const { createCanvas, loadImage } = require('canvas');
const path = require('path');

/**
 * Generate a welcome card image for new members
 * @param {Object} options - Card generation options
 * @param {string} options.username - Member's username
 * @param {string} options.avatarUrl - Member's avatar URL
 * @param {string} options.guildName - Guild/server name
 * @param {number} options.memberCount - Total member count
 * @param {string} options.welcomeText - Custom welcome message
 * @returns {Buffer} - PNG image buffer
 */
async function generateWelcomeCard({
  username,
  avatarUrl,
  guildName,
  memberCount,
  welcomeText = 'Welcome to the server!'
}) {
  // Canvas dimensions
  const width = 800;
  const height = 300;
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#4c63d2');
  gradient.addColorStop(0.5, '#7c3aed');
  gradient.addColorStop(1, '#2563eb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add subtle overlay for better text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, width, height);
  
  // Add a subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  
  try {
    // Load and draw avatar
    if (avatarUrl) {
      const avatar = await loadImage(avatarUrl);
      
      // Create circular clipping mask for avatar
      const avatarSize = 120;
      const avatarX = 50;
      const avatarY = height / 2 - avatarSize / 2;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // Draw avatar
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      
      // Avatar border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } catch (error) {
    console.warn('Failed to load avatar for welcome card:', error.message);
    
    // Fallback: draw default avatar circle
    const avatarSize = 120;
    const avatarX = 50;
    const avatarY = height / 2 - avatarSize / 2;
    
    ctx.fillStyle = '#36393f';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Default avatar text (first letter of username)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      username.charAt(0).toUpperCase(),
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2
    );
    
    // Avatar border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Clean and simple text layout
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  const textX = 200;
  let currentY = 70;
  
  // Title "Welcome!"
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Welcome!', textX, currentY);
  currentY += 50;
  
  // Username prominently displayed
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#ffd700'; // Gold color for username
  ctx.fillText(username, textX, currentY);
  currentY += 50;
  
  // Server name
  ctx.font = '22px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(`to ${guildName}`, textX, currentY);
  currentY += 35;
  
  // Member count
  ctx.font = '18px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`Member #${memberCount}`, textX, currentY);
  
  // Simple decorative line
  ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Subtle gold accent
  ctx.fillRect(textX - 15, 65, 4, 140);
  
  return canvas.toBuffer('image/png');
}

/**
 * Wrap text to fit within specified width
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width
 * @returns {string[]} - Array of text lines
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Limit to maximum 3 lines to prevent overflow
  return lines.slice(0, 3);
}

module.exports = {
  generateWelcomeCard
};
