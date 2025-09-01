const MAX_DISCORD_MESSAGE = 2000;
async function sendLongReply(interaction, text){
  let s = (text||'').toString();
  if (s.length<=MAX_DISCORD_MESSAGE) {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(s);
    } else {
      return await interaction.reply(s);
    }
  }
  
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(s.slice(0,MAX_DISCORD_MESSAGE));
  } else {
    await interaction.reply(s.slice(0,MAX_DISCORD_MESSAGE));
  }
  
  s = s.slice(MAX_DISCORD_MESSAGE);
  while(s.length){
    const part = s.slice(0,MAX_DISCORD_MESSAGE); 
    s=s.slice(MAX_DISCORD_MESSAGE);
    await interaction.followUp({ content: part });
  }
}
async function buildImageEmbedResponse(interaction, urls, explanation){
  const firstUrl = urls[0];
  const chunks=[]; let remaining = explanation || 'No explanation.'; const MAX_EMBED_DESC=4000;
  while(remaining.length){ chunks.push(remaining.slice(0,MAX_EMBED_DESC)); remaining = remaining.slice(MAX_EMBED_DESC);} 
  const { default: axios } = await import('axios');
  let fileBuffer=null, filename='image.png';
  try {
    const resp = await axios.get(firstUrl,{responseType:'arraybuffer'});
    if (resp.data && resp.data.byteLength < 8*1024*1024) { fileBuffer = Buffer.from(resp.data); }
  } catch {}
  const embed = { title: 'Image Explanation', description: chunks.shift(), image: { url: fileBuffer? 'attachment://image.png': firstUrl }, color:0x5865F2, footer:{ text: urls.length>1? `${urls.length} images`:'Single image'} };
  await interaction.editReply({ embeds:[embed], files: fileBuffer? [{ attachment:fileBuffer, name: filename }]: [] });
  for (const c of chunks) await interaction.followUp({ content:c });
}
function reformatMarkdownTables(text){
  if (!text || typeof text !== 'string') return text;
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length){
    const line = lines[i];
    // Detect potential table header (contains at least one pipe) and next line is separator
    if (line.includes('|') && i+1 < lines.length){
      const sep = lines[i+1].trim();
      const sepIsTable = /^\s*\|?\s*:?-{1,}\s*(\|\s*:?-{1,}\s*)+\|?\s*$/.test(sep);
      if (sepIsTable){
        // Collect table block
        const tableLines = [line];
        tableLines.push(lines[i+1]);
        i += 2;
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== ''){ tableLines.push(lines[i]); i++; }
        // Parse cells ignoring alignment row
        const dataRows = tableLines.filter((_,idx)=>idx!==1); // exclude separator
        const rows = dataRows.map(l=> l.split('|').map(c=>c.trim()).filter((_,ci,arr)=>!(ci===0 && arr[ci]==='') && !(ci===arr.length-1 && arr[ci]==='')) );
        // Compute widths
        const colCount = Math.max(...rows.map(r=>r.length));
        const widths = new Array(colCount).fill(0);
        for (const r of rows){
          r.forEach((c,j)=>{ if (c.length > widths[j]) widths[j]=Math.min(60,c.length); });
        }
        const makeRow = (r)=> r.map((c,j)=>{
          let cell = c.length>60? c.slice(0,57)+'…' : c;
          return cell.padEnd(widths[j], ' ');
        }).join(' | ');
        const header = makeRow(rows[0]||[]);
        const separator = widths.map(w=>'-'.repeat(Math.min(w, w))).join('-+-');
        const body = rows.slice(1).map(makeRow);
        const ascii = ['```','TABLE',''+header, separator, ...body, '```'];
        out.push(...ascii);
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

function formatAIOutput(text){
  return reformatMarkdownTables(text);
}

module.exports = { sendLongReply, buildImageEmbedResponse, formatAIOutput };
