// /meme command: fetches a random meme image + title from https://meme-api.com/gimme (no key).
// Uses native fetch (Node 18+). Falls back gracefully if API fails.
const fetchFn = (...args) => globalThis.fetch(...args);

module.exports = {
  name: 'meme',
  execute: async (interaction) => {
    await interaction.deferReply();
    try {
      const q = interaction.options.getString('query');
      // meme-api search endpoint: /gimme/{subreddit or multiple}; no official keyword search.
      // Workaround: if user supplies a query, attempt subreddit first; else fallback to random.
      // If query contains spaces, replace with '' and lowercase (likely subreddit). If it fails, fallback.
      let url = 'https://meme-api.com/gimme';
      if(q){
        const sub = q.toLowerCase().replace(/[^a-z0-9_]+/g,'');
        if(sub) url = `https://meme-api.com/gimme/${encodeURIComponent(sub)}`;
      }
      let resp = await fetchFn(url);
      if(!resp.ok && q){
        // retry generic random if subreddit invalid
        resp = await fetchFn('https://meme-api.com/gimme');
      }
      if(!resp.ok) throw new Error('API error '+resp.status);
      if(!resp.ok) throw new Error('API error '+resp.status);
      const data = await resp.json();
      // data: { postLink, subreddit, title, url, nsfw, spoiler }
      if(!data || !data.url){
        await interaction.editReply('No meme received.');
        return;
      }
      const title = data.title?.slice(0,256) || 'Meme';
      const embed = {
        title: q ? `${title}` : title,
        url: data.postLink || undefined,
        image: { url: data.url },
        footer: { text: data.subreddit ? `r/${data.subreddit}` : 'meme-api.com' },
        color: 0x5865F2
      };
      await interaction.editReply({ embeds:[embed] });
    } catch (e){
      await interaction.editReply('Failed to fetch meme: '+ (e.message || 'error'));
    }
  }
};
