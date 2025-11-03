const LeaderboardCanvas = require('../../utils/leaderboard/LeaderboardCanvas');
const { createCanvas } = require('canvas');

/**
 * CWLLeaderboardCanvas
 * Enhanced wrapper around the regular war LeaderboardCanvas with support for dual-page layout
 * for large wars (>25 players). Splits players into two side-by-side pages on a single canvas.
 */
class CWLLeaderboardCanvas {
  constructor() {
    this.base = new LeaderboardCanvas();
    this.MAX_PLAYERS_PER_PAGE = 25; // Split into 2 pages if more than 25 players
  }

  /**
   * Generate a CWL war leaderboard image.
   * Automatically creates a dual-page layout for wars with >25 players.
   * - players: array of mapped player objects (same shape as regular war canvas expects)
   * - config: { clan_name, clan_tag, ... }
   * - warData: object containing at least { currentWar: {...}, clanName, clanTag }
   * - warState: 'preparation' | 'inWar' | 'warEnded'
   */
  async generateCWLWarLeaderboard(players, config, page = 1, totalPages = 1, warData = {}, warState = 'ended') {
    // If 25 or fewer players, use single page layout
    if (players.length <= this.MAX_PLAYERS_PER_PAGE) {
      return this.base.generateWarLeaderboard(players, config, page, totalPages, warData, warState);
    }

    // For >25 players, create dual-page layout
    return this.generateDualPageCanvas(players, config, warData, warState);
  }

  /**
   * Generate a dual-page canvas with players split into two columns
   * Left page: Players 1-25 (or 1-N if N < 25)
   * Right page: Players 26-50 (or remaining players)
   */
  async generateDualPageCanvas(players, config, warData, warState) {
    try {
      // Split players into two groups
      const leftPlayers = players.slice(0, this.MAX_PLAYERS_PER_PAGE);
      const rightPlayers = players.slice(this.MAX_PLAYERS_PER_PAGE);

      console.log(`[CWL Canvas] Generating dual-page canvas: ${leftPlayers.length} + ${rightPlayers.length} players`);

      // Generate both pages
      const leftBuffer = await this.base.generateWarLeaderboard(
        leftPlayers, 
        config, 
        1, 
        2, 
        warData, 
        warState
      );
      
      const rightBuffer = await this.base.generateWarLeaderboard(
        rightPlayers, 
        config, 
        2, 
        2, 
        warData, 
        warState
      );

      // Load both canvases
      const { loadImage } = require('canvas');
      const leftImage = await loadImage(leftBuffer);
      const rightImage = await loadImage(rightBuffer);

      // Calculate dimensions for combined canvas
      const maxHeight = Math.max(leftImage.height, rightImage.height);
      const totalWidth = leftImage.width + rightImage.width;
      
      // Create combined canvas
      const combinedCanvas = createCanvas(totalWidth, maxHeight);
      const ctx = combinedCanvas.getContext('2d');

      // Draw both pages side by side
      ctx.drawImage(leftImage, 0, 0);
      ctx.drawImage(rightImage, leftImage.width, 0);

      console.log(`[CWL Canvas] Combined canvas: ${totalWidth}x${maxHeight}px`);

      return combinedCanvas.toBuffer('image/png');
    } catch (error) {
      console.error('[CWL Canvas] Error generating dual-page canvas:', error);
      throw error;
    }
  }
}

module.exports = CWLLeaderboardCanvas;
