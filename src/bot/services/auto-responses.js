// List of auto response definitions.
// Each item: { key, pattern: RegExp, replies: string[] }
// Extend or modify as needed. Patterns are matched against the full trimmed message.
module.exports = [
  { 
    key: 'pagi', 
    pattern: /\b(?:pagi|selamat pagi|morning|gm|mowning|moaning)\b/i,  
    replies: ['Pagi juga! ☀️', 'Met pagi!', 'Halo, selamat pagi!', 'Pagi bro!'] 
  },
  { 
    key: 'siang', 
    pattern: /\b(?:siang|selamat siang)\b/i, 
    replies: ['Siang!', 'Met siang!', 'Halo, selamat siang!'] 
  },
  { 
    key: 'sore', 
    pattern: /\b(?:sore|selamat sore)\b/i, 
    replies: ['Sore!', 'Met sore!', 'Halo, selamat sore!'] 
  },
  { 
    key: 'malam', 
    pattern: /\b(?:malam|selamat malam|malem|night|gn|nite)\b/i, 
    replies: ['Malam! 🌙', 'Met malem!', 'Selamat malam juga!', 'Tidur nyenyak!'] 
  },
  { 
    key: 'jam', 
    pattern: /\b(?:waktu|jam|time)\b/i, 
    replies: [
        () => `Waktu sekarang: ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        () => `Sekarang jam: ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
        () => {
        const now = new Date();
        return `🕐 ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        }
    ] 
    },
  { 
    key: 'hai', 
    pattern: /^(?:hai|halo|hello|hi|hey|hoi)$/i, 
    replies: ['Hai juga!', 'Halo!', 'Apa kabar?', 'Yahalo!'] 
  },
  { 
    key: 'bye', 
    pattern: /^(?:bye|dadah|daah|selamat tinggal|see ya|sampai jumpa)$/i, 
    replies: ['Dadah! 👋', 'Sampai jumpa!', 'Yaudah bye dulu!', 'See you!'] 
  },
  { 
    key: 'makasih', 
    pattern: /\b(?:makasih|makasi|thanks|thank you|thx|terima kasih)\b/i, 
    replies: ['Sama-sama! 😊', 'Gapapa!', 'Santai aja bro!', 'Anytime!'] 
  },
  { 
    key: 'maaf', 
    pattern: /\b(?:maaf|sorry|ampun)\b/i, 
    replies: ['Gapapa kok!', 'Santai, no problem!', 'Udah diampuni! 😄'] 
  },
  { 
    key: 'lucu', 
    pattern: /^(?:lucu|ngakak|wkwk|kocak|gemoy)$/i, 
    replies: ['Wkwkwk 😂', 'Thanks ya!', 'Haha iya deh!'] 
  },
  { 
    key: 'capek', 
    pattern: /^(?:capek|lelah|cape|lemes)$/i, 
    replies: ['Istirahat dulu bro!', 'Minum air putih!', 'Tidur dulu gih! 😴'] 
  },
  { 
    key: 'lapar', 
    pattern: /\b(?:lapar|laper|mau makan)\b/i, 
    replies: ['Makan dulu! 🍔', 'Gue juga laper nih!', 'Order gofood yuk!'] 
  },
  { 
    key: 'ngantuk', 
    pattern: /\b(?:ngantuk|kantuk|tidur)\b/i,  
    replies: ['Tidur dulu bro!', 'Jangan lupa rebahan!', 'Met tidur! 💤'] 
  },
  { 
    key: 'gabut', 
    pattern: /\b(?:gabut|boring|bosan|bosen)\b/i,  
    replies: ['Main game yuk! 🎮', 'Nonton film yuk!', 'Mari kita obrolin sesuatu!'] 
  },
  { 
    key: 'keren', 
    pattern: /^(?:keren|mantap|mantul|keren banget)$/i, 
    replies: ['Makasih bro! 👍', 'Lo juga keren!', 'Aww, bikin meleleh!'] 
  },
  { 
    key: 'gimana', 
    pattern: /^(?:gimana|how|apa kabar)$/i, 
    replies: ['Lagi baik bro!', 'Alhamdulillah oke!', 'Gue baik, lo gimana?'] 
  },
  { 
    key: 'f', 
    pattern: /^f$/i, 
    replies: ['Press F to pay respects. 🇫', 'Respect! 🇫'] 
  },
  { 
    key: 'anjay', 
    pattern: /^(?:anjay|anjir|astaga|waduh)$/i, 
    replies: ['Waduh!', 'Wkwkw iya anjir!', 'Gimana tuh!'] 
  },
  { 
    key: 'mantul', 
    pattern: /^(?:mantul|mantap|oke)$/i, 
    replies: ['Mantul bro! 🔥', 'Yes!', 'Oke gas!'] 
  },
  { 
    key: 'santai', 
    pattern: /^(?:santai|relax|tenang)$/i, 
    replies: ['Santai aja bro! 😎', 'Take it easy!', 'Hidup santai aja!'] 
  },
  { 
    key: 'help', 
    pattern: /^(?:bantuan|help|tolong|bot)$/i, 
    replies: ['Gue lagi turu!'] 
  },
  // ===== RESPONSES BARU UNTUK GAMING =====
  { 
    key: 'main_game', 
    pattern: /\b(?:main|game|gaming|let's play|gas game|maen)\b/i, 
    replies: ['Gas main! 🎮', 'Ayo squad!', 'Gue mau join!', 'Lobby-nya mana nih?'] 
  },
  { 
    key: 'rank', 
    pattern: /^(?:rank|ranked|competitive|push rank)$/i, 
    replies: ['Push rank yuk!', 'Awas toxic di ranked!', 'Semangat push rank! 💪'] 
  },
  { 
    key: 'congrats', 
    pattern: /\b(?:selamat ya|congrats|grats)\b/i, 
    replies: ['🎉 Woo! Congrats! 🎉', 'Selamat ya bro! 💪'] 
  },
  { 
    key: 'noob', 
    pattern: /^(?:noob|nub|lemah)$/i, 
    replies: ['Wkwkw masih belajar bro!', 'Beli skin dulu biar pro!', 'Practice makes perfect!'] 
  },
  { 
    key: 'pro', 
    pattern: /^(?:pro|gacor|gaming)$/i, 
    replies: ['Gacor banget sih! 🔥', 'Pro player nih!', 'Carry me bro!'] 
  },
  { 
    key: 'toxic', 
    pattern: /^(?:toxic|salah tim|team mate|bacot)$/i, 
    replies: ['Santai bro, jangan toxic!', 'Mute aja yang toxic!', 'Remember: itu cuma game!'] 
  },
  { 
    key: 'win', 
    pattern: /^(?:win|menang|victory|ez)$/i, 
    replies: ['EZ win! 🏆', 'GGWP!', 'Mantap menang!', 'Teamwork makes the dream work!'] 
  },
  { 
    key: 'lose', 
    pattern: /^(?:lose|kalah|defeat|team salah)$/i, 
    replies: ['GG, next match!', 'Lagi unlucky aja bro!', 'Take a break dulu!'] 
  },
  { 
    key: 'carry', 
    pattern: /^(?:carry|bawain|bantuan|gendong)$/i, 
    replies: ['Gue carry! 💪', 'Siapa yang mau dibawain?', 'Pick hero carry bro!'] 
  },
  { 
    key: 'afk', 
    pattern: /^(?:afk|brb|wait|tunggu)$/i, 
    replies: ['AFK dulu, toilet! 🚽', 'Jangan AFK lama-lama!', 'Cepet balik ya!'] 
  },
  { 
    key: 'item', 
    pattern: /^(?:item|build|gear|equip|loadout)$/i, 
    replies: ['Build yang meta bro!', 'Cek pro player build!', 'Item sesuai situasi!'] 
  },
  { 
    key: 'lag', 
    pattern: /^(?:lag|delay|ping|high ping)$/i, 
    replies: ['Restart router bro!', 'Wifi nya lemot nih!', 'Ping merah? Sad life!'] 
  },
  { 
    key: 'update', 
    pattern: /^(?:update|patch|maintenance)$/i, 
    replies: ['Update dulu bro!', 'Patch notes dong!', 'Ada buff/nerf apa ya?'] 
  },
  { 
    key: 'event', 
    pattern: /^(?:event|mission|quest|task|misi)$/i, 
    replies: ['Grind event yuk!', 'Jangan lupa daily quest!', 'Ada event baru nih!'] 
  },
  { 
    key: 'skin', 
    pattern: /^(?:skin|cosmetic|outfit|character design)$/i, 
    replies: ['Skin = damage boost! 💰', 'Duitnya habis buat gacha!', 'Limited skin coming!'] 
  },
  { 
    key: 'buff', 
    pattern: /^(?:buff|nerf|op|overpowered)$/i, 
    replies: ['Minta buff dong!', 'Hero gue kena nerf lagi!', 'Ini hero OP banget!'] 
  },
  { 
    key: 'clutch', 
    pattern: /^(?:clutch|comeback|reverse sweep)$/i, 
    replies: ['Clutch or kick!', 'Masih bisa comeback!', 'Reverse sweep incoming!'] 
  },
  { 
    key: 'rage', 
    pattern: /^(?:rage|quit|uninstall|gak kuat)$/i, 
    replies: ['Santai bro, jangan rage quit!', 'Take a deep breath!', 'Main yang lain dulu!'] 
  },
  { 
    key: 'tourney', 
    pattern: /^(?:tournament|tourney|compete|lomba)$/i, 
    replies: ['Tourney apa nih?', 'Join tournament yuk!', 'Prize pool-nya gede?'] 
  },
  { 
    key: 'stream', 
    pattern: /^(?:stream|livestream|nobar|watch|live)$/i, 
    replies: ['Nobar tournament yuk!', 'Streamer favorit lo siapa?', 'Live dimana nih?'] 
  },
  { 
    key: 'grind', 
    pattern: /^(?:grind|farm|level up|naik level)$/i, 
    replies: ['Grind sampai tangan keriting!', 'No life grind!', 'Ayo farming bareng!'] 
  }
];
