import fs from 'node:fs';
import path from 'node:path';

// Load file .env jika tersedia (fitur native bawaan Node.js 20+)
if (fs.existsSync('.env') && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Abaikan jika .env kosong / format error
  }
}

// ============================================================================
// ANSI Styling & Warna Terminal
// ============================================================================
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright colors
  bGreen: '\x1b[92m',
  bYellow: '\x1b[93m',
  bBlue: '\x1b[94m',
  bMagenta: '\x1b[95m',
  bCyan: '\x1b[96m',
  bWhite: '\x1b[97m',

  // Badges
  tagInfo: (text) => `\x1b[44m\x1b[97m\x1b[1m ${text} \x1b[0m`,
  tagSuccess: (text) => `\x1b[42m\x1b[97m\x1b[1m ${text} \x1b[0m`,
  tagWarn: (text) => `\x1b[43m\x1b[30m\x1b[1m ${text} \x1b[0m`,
  tagError: (text) => `\x1b[41m\x1b[97m\x1b[1m ${text} \x1b[0m`,
  tagPurple: (text) => `\x1b[45m\x1b[97m\x1b[1m ${text} \x1b[0m`
};

const BASE_URL = 'https://beta.auralaunch.org';
const TOKENS_FILE = path.resolve(process.cwd(), 'tokens.txt');

// Delay helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper untuk menghapus kode ANSI agar perhitungan panjang teks visual akurat
function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

// Helper perataan teks dengan perhitungan panjang visual
function padText(text, width, align = 'left') {
  const visible = stripAnsi(text);
  const diff = width - visible.length;
  if (diff <= 0) return text;
  if (align === 'right') return ' '.repeat(diff) + text;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + text + ' '.repeat(right);
  }
  return text + ' '.repeat(diff);
}

// Helper merender tabel dengan border box Unicode presisi
function renderTable(cols, rows) {
  const top = `${c.cyan}┌─` + cols.map(col => '─'.repeat(col.width)).join('─┬─') + `─┐${c.reset}`;
  const mid = `${c.cyan}├─` + cols.map(col => '─'.repeat(col.width)).join('─┼─') + `─┤${c.reset}`;
  const bot = `${c.cyan}└─` + cols.map(col => '─'.repeat(col.width)).join('─┴─') + `─┘${c.reset}`;

  console.log(top);
  console.log(`${c.cyan}│${c.reset} ` + cols.map(col => `${c.bold}` + padText(col.header, col.width, 'center') + `${c.reset}`).join(` ${c.cyan}│${c.reset} `) + ` ${c.cyan}│${c.reset}`);
  console.log(mid);

  for (const row of rows) {
    const cells = cols.map((col, idx) => {
      const val = row[idx];
      return padText(val, col.width, col.align);
    });
    console.log(`${c.cyan}│${c.reset} ` + cells.join(` ${c.cyan}│${c.reset} `) + ` ${c.cyan}│${c.reset}`);
  }

  console.log(bot);
}

function getHeaders(token) {
  return {
    'Accept': '*/*',
    'Accept-Language': 'en,en-US;q=0.9,id;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    'Cookie': `aura_token=${token}`,
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/incentives`
  };
}

// 1. Ambil Profil & Poin
async function getProfile(token) {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: getHeaders(token)
  });
  return res.json();
}

// 2. Claim Daily Login
async function claimDailyLogin(token) {
  const res = await fetch(`${BASE_URL}/api/auth/me/claim`, {
    method: 'POST',
    headers: getHeaders(token)
  });
  return res.json();
}

// 3. Ambil Quiz Harian
async function getDailyQuiz(token) {
  const res = await fetch(`${BASE_URL}/api/quiz`, {
    headers: getHeaders(token)
  });
  return res.json();
}

// 4. Submit Jawaban Quiz
async function submitQuizAnswer(token, quizId, answerIndex) {
  const res = await fetch(`${BASE_URL}/api/quiz/answer/submit`, {
    method: 'POST',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: String(quizId),
      answer: Number(answerIndex)
    })
  });
  return res.json();
}

// Cache jawaban kuis terverifikasi antar akun dalam satu kali jalan
const verifiedQuizCache = new Map();

// Panggil Google Gemini AI API secara native via fetch
async function askGeminiAI(question, options, apiKey) {
  const prompt = `You are an expert in Web3, cryptocurrency, and blockchain technology.
Answer the following multiple-choice quiz question correctly.

Question: "${question}"

Options:
${options.map((opt, idx) => {
  const k = Object.keys(opt)[0];
  return `[${idx}] (${k.toUpperCase()}) ${opt[k]}`;
}).join('\n')}

INSTRUCTION: Respond with ONLY a single digit (0, 1, 2, or 3) indicating the index of the correct option. Do NOT output any other words or punctuation.`;

  const models = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.5-flash'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.0, maxOutputTokens: 5 }
        })
      });

      if (!res.ok) continue;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const match = text.match(/\b([0-3])\b/);
      if (match) {
        return parseInt(match[1], 10);
      }
    } catch {
      // Coba model berikutnya jika gagal
    }
  }
  return -1;
}

// Deteksi Jawaban menggunakan Rule Engine Web3 kata kunci
function detectAnswerByRules(question, options) {
  const q = question.toLowerCase();

  const rules = [
    { match: /slashing/i, answerMatch: /forfeiture|punishment|penalty|destruction.*validator/i },
    { match: /proof of stake|pos/i, answerMatch: /validator|staking|stake/i },
    { match: /proof of work|pow/i, answerMatch: /mining|miner|computational/i },
    { match: /smart contract/i, answerMatch: /self-executing|code|blockchain/i },
    { match: /gas/i, answerMatch: /fee|computational effort/i },
    { match: /layer 2|l2|rollup/i, answerMatch: /scalab|off-chain/i },
    { match: /defi/i, answerMatch: /decentralized finance/i },
    { match: /dex/i, answerMatch: /decentralized exchange|amm|automated market/i },
    { match: /dao/i, answerMatch: /autonomous organization|governance/i },
    { match: /airdrop/i, answerMatch: /free|reward|distribution/i },
    { match: /impermanent loss/i, answerMatch: /price divergence|liquidity provider/i },
    { match: /halving/i, answerMatch: /50%|block reward.*half/i }
  ];

  for (const rule of rules) {
    if (rule.match.test(q)) {
      for (let i = 0; i < options.length; i++) {
        const text = Object.values(options[i])[0];
        if (rule.answerMatch.test(text)) {
          return i;
        }
      }
    }
  }

  return -1;
}

// Resolver Utama: Cache Terverifikasi -> Gemini AI -> Rule Engine
async function resolveQuizAnswer(quizId, question, options) {
  // 1. Cek cache terverifikasi dari akun sebelumnya
  if (verifiedQuizCache.has(quizId)) {
    return {
      index: verifiedQuizCache.get(quizId),
      source: 'Verified Cache (Akun Sebelumnya)'
    };
  }

  // 2. Jika ada GEMINI_API_KEY, tanyakan ke AI
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    const aiIndex = await askGeminiAI(question, options, apiKey);
    if (aiIndex >= 0 && aiIndex < options.length) {
      return {
        index: aiIndex,
        source: 'Google Gemini AI'
      };
    }
  }

  // 3. Fallback: Gunakan Web3 Rule Engine
  const ruleIndex = detectAnswerByRules(question, options);
  if (ruleIndex !== -1) {
    return {
      index: ruleIndex,
      source: 'Web3 Rule Engine'
    };
  }

  return {
    index: -1,
    source: 'None'
  };
}

// Baca tokens.txt
function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) {
    console.log(`${c.tagWarn('PERINGATAN')} File ${c.bold}tokens.txt${c.reset} tidak ditemukan! Membuat template file...`);
    fs.writeFileSync(TOKENS_FILE, '# Masukkan daftar token di sini, 1 token per baris\n');
    return [];
  }

  const content = fs.readFileSync(TOKENS_FILE, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      // Bersihkan jika user menyalin dengan format "aura_token=..." atau tanda kutip
      let clean = line.replace(/^aura_token=/i, '').replace(/;.*$/, '').trim();
      clean = clean.replace(/^['"]|['"]$/g, '').trim();
      return clean;
    })
    .filter((token) => token.length > 0);
}

// Main Runner
async function main() {
  // Clear screen dan reset kursor ke posisi paling atas
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

  console.log(`${c.bCyan}╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                        AURA PROTOCOL DAILY BOT (MULTI-ACCOUNT)                        ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  const tokens = loadTokens();

  if (tokens.length === 0) {
    console.log(`${c.tagError('ERROR')} Tidak ada token di ${c.bold}tokens.txt${c.reset}. Silakan isi minimal satu token!`);
    return;
  }

  console.log(`${c.cyan}ℹ️  Terdeteksi ${c.bold}${tokens.length}${c.reset}${c.cyan} akun di ${c.bold}tokens.txt${c.reset}`);

  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (hasGemini) {
    console.log(`${c.green}🤖 Solver   : ${c.tagSuccess('GEMINI AI')} Menggunakan Google Gemini AI untuk kuis otomatis${c.reset}\n`);
  } else {
    console.log(`${c.dim}🤖 Solver   : Web3 Rule Engine (Opsional: Tambahkan GEMINI_API_KEY di .env agar 100% akurat)${c.reset}\n`);
  }

  const summary = [];

  const BOX_WIDTH = 87; // lebar dalam (total dengan border kiri kanan = 89)

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const accNum = i + 1;
    const shortToken = token.length > 20 ? `${token.substring(0, 10)}...${token.substring(token.length - 8)}` : token;

    const titleText = `AKUN #${accNum} of ${tokens.length} (Token: ${shortToken})`;

    console.log(`${c.bBlue}┌─${'─'.repeat(BOX_WIDTH)}─┐${c.reset}`);
    console.log(`${c.bBlue}│${c.reset} ${c.bWhite}${c.bold}${padText(titleText, BOX_WIDTH, 'left')}${c.reset} ${c.bBlue}│${c.reset}`);
    console.log(`${c.bBlue}└─${'─'.repeat(BOX_WIDTH)}─┘${c.reset}`);

    let accResult = {
      account: `#${accNum}`,
      address: '-',
      initialPoints: 0,
      finalPoints: 0,
      dailyStatus: 'Gagal',
      quizStatus: 'Gagal'
    };

    try {
      // 1. Ambil Profil Akun
      const auth = await getProfile(token);
      if (auth.status !== 'success' || !auth.profile) {
        console.log(`  ${c.tagError('LOGIN')} ${c.red}Gagal verifikasi token. Token mungkin expired atau invalid.${c.reset}`);
        accResult.dailyStatus = 'Token Expired';
        accResult.quizStatus = 'Token Expired';
        summary.push(accResult);
        console.log('');
        continue;
      }

      const p = auth.profile;
      accResult.address = `${p.address.substring(0, 6)}...${p.address.substring(p.address.length - 4)}`;
      accResult.initialPoints = p.points;
      accResult.finalPoints = p.points;

      console.log(`  ${c.cyan}👤 Address :${c.reset} ${c.bold}${p.address}${c.reset}`);
      console.log(`  ${c.yellow}⭐ Points  :${c.reset} ${c.bYellow}${p.points.toLocaleString()}${c.reset}`);
      console.log(`  ${c.magenta}🔥 Streak  :${c.reset} ${p.daily_login?.streak || 0} Hari`);

      // 2. Claim Daily Login
      if (p.daily_login?.is_claimable) {
        console.log(`  ${c.cyan}🎁 Daily   :${c.reset} Melakukan claim reward harian...`);
        const claim = await claimDailyLogin(token);
        if (claim.status === 'success') {
          const reward = p.daily_login.next_reward || 0;
          accResult.dailyStatus = `+${reward} Poin`;
          console.log(`  ${c.tagSuccess('DAILY')} ${c.bGreen}Berhasil claim daily reward: +${reward} points!${c.reset}`);
        } else {
          accResult.dailyStatus = 'Gagal';
          console.log(`  ${c.tagWarn('DAILY')} Respon: ${claim.message || 'Gagal claim'}`);
        }
      } else {
        accResult.dailyStatus = 'Sudah Claim';
        console.log(`  ${c.tagInfo('DAILY')} ${c.dim}Sudah di-claim untuk hari ini.${c.reset}`);
      }

      // 3. Cek Quiz Harian
      const quizData = await getDailyQuiz(token);
      if (quizData.status === 'success' && quizData.hasQuiz && quizData.data) {
        const quiz = quizData.data;
        console.log(`  ${c.cyan}🧩 Quiz    :${c.reset} ${c.bWhite}"${quiz.question}"${c.reset} ${c.dim}(+${quiz.points} pts)${c.reset}`);

        // Tampilkan opsi
        quiz.options.forEach((opt, idx) => {
          const key = Object.keys(opt)[0];
          console.log(`     ${c.dim}[${idx}] (${key.toUpperCase()})${c.reset} ${opt[key]}`);
        });

        // Deteksi jawaban (AI / Cache / Rules)
        const { index: ansIndex, source } = await resolveQuizAnswer(quiz.id, quiz.question, quiz.options);

        if (ansIndex !== -1) {
          const chosenOpt = quiz.options[ansIndex];
          const chosenKey = Object.keys(chosenOpt)[0];
          console.log(`  ${c.cyan}💡 Jawaban :${c.reset} Index ${ansIndex} (${chosenKey.toUpperCase()}) -> ${c.green}${chosenOpt[chosenKey]}${c.reset} ${c.dim}[Sumber: ${source}]${c.reset}`);

          const submit = await submitQuizAnswer(token, quiz.id, ansIndex);
          if (submit.isCorrect) {
            verifiedQuizCache.set(quiz.id, ansIndex); // Simpan agar akun berikutnya langsung pakai jawaban benar ini
            accResult.quizStatus = `+${quiz.points} Poin`;
            console.log(`  ${c.tagSuccess('QUIZ')} ${c.bGreen}Jawaban BENAR! Mendapatkan +${quiz.points} points!${c.reset}`);
          } else {
            accResult.quizStatus = 'Salah/Gagal';
            console.log(`  ${c.tagWarn('QUIZ')} ${c.red}Jawaban tidak tepat atau sudah disubmit.${c.reset}`);
          }
        } else {
          accResult.quizStatus = 'Manual';
          console.log(`  ${c.tagWarn('QUIZ')} Tidak dapat mendeteksi jawaban. Silakan set GEMINI_API_KEY di .env`);
        }
      } else {
        accResult.quizStatus = 'Sudah Selesai';
        console.log(`  ${c.tagInfo('QUIZ')} ${c.dim}Tidak ada quiz aktif / sudah dikerjakan.${c.reset}`);
      }

      // 4. Update Saldo Akhir
      const updated = await getProfile(token);
      if (updated.profile) {
        accResult.finalPoints = updated.profile.points;
        const diff = accResult.finalPoints - accResult.initialPoints;
        const diffText = diff > 0 ? `${c.bGreen}(+${diff.toLocaleString()})${c.reset}` : `${c.dim}(+0)${c.reset}`;
        console.log(`  ${c.bYellow}🏆 Saldo   :${c.reset} ${c.bWhite}${c.bold}${updated.profile.points.toLocaleString()}${c.reset} Poin ${diffText}`);
      }

    } catch (err) {
      console.log(`  ${c.tagError('ERROR')} ${c.red}${err.message}${c.reset}`);
      accResult.dailyStatus = 'Error';
      accResult.quizStatus = 'Error';
    }

    summary.push(accResult);
    console.log('');

    // Jeda antar akun
    if (i < tokens.length - 1) {
      console.log(`${c.dim}⏳ Menunggu jeda 2 detik sebelum akun berikutnya...${c.reset}\n`);
      await sleep(2000);
    }
  }

  // ============================================================================
  // Tabel Ringkasan Presisi
  // ============================================================================
  console.log(`\n${c.bCyan}╔═══════════════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                              ${c.bold}RINGKASAN EKSEKUSI SEMUA AKUN${c.reset}${c.bCyan}                            ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);

  const cols = [
    { header: 'Akun', width: 6, align: 'center' },
    { header: 'Address', width: 18, align: 'center' },
    { header: 'Daily Claim', width: 17, align: 'center' },
    { header: 'Quiz Harian', width: 17, align: 'center' },
    { header: 'Total Poin', width: 15, align: 'right' }
  ];

  const rows = summary.map((s) => {
    const dailyColor = s.dailyStatus.includes('+') ? c.bGreen : (s.dailyStatus.includes('Sudah') ? c.dim : c.yellow);
    const quizColor = s.quizStatus.includes('+') ? c.bGreen : (s.quizStatus.includes('Sudah') ? c.dim : c.yellow);

    return [
      `${c.bold}#${s.account.replace('#', '')}${c.reset}`,
      s.address,
      `${dailyColor}${s.dailyStatus}${c.reset}`,
      `${quizColor}${s.quizStatus}${c.reset}`,
      `${c.bYellow}${s.finalPoints.toLocaleString()}${c.reset}`
    ];
  });

  renderTable(cols, rows);

  console.log(`\n${c.bGreen}✅ Selesai memproses ${tokens.length} akun!${c.reset}\n`);
}

main();
