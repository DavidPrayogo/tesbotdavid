const axios = require('axios');
const schedule = require('node-schedule');
require('dotenv').config();

const TELEGRAM_MINI_APP_URL = 'https://gateway.blum.codes/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP';
const START_FARMING_URL = 'https://game-domain.blum.codes/api/v1/farming/start';
const CLAIM_FARMING_URL = 'https://game-domain.blum.codes/api/v1/farming/claim';
const USER_BALANCE_URL = 'https://game-domain.blum.codes/api/v1/user/balance';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const accounts = [
    {
        name: 'Akun 1',
        accessToken: process.env.ACCOUNT_1_ACCESS_TOKEN,
        refreshToken: process.env.ACCOUNT_1_REFRESH_TOKEN,
        query: process.env.ACCOUNT_1_QUERY
    },
    {
        name: 'Akun 2',
        accessToken: process.env.ACCOUNT_2_ACCESS_TOKEN,
        refreshToken: process.env.ACCOUNT_2_REFRESH_TOKEN,
        query: process.env.ACCOUNT_2_QUERY
    },
    {
        name: 'Akun 3',
        accessToken: process.env.ACCOUNT_3_ACCESS_TOKEN,
        refreshToken: process.env.ACCOUNT_3_REFRESH_TOKEN,
        query: process.env.ACCOUNT_3_QUERY
    },
    {
        name: 'Akun 4',
        accessToken: process.env.ACCOUNT_4_ACCESS_TOKEN,
        refreshToken: process.env.ACCOUNT_4_REFRESH_TOKEN,
        query: process.env.ACCOUNT_4_QUERY
    },
    {
        name: 'Akun 5',
        accessToken: process.env.ACCOUNT_5_ACCESS_TOKEN,
        refreshToken: process.env.ACCOUNT_5_REFRESH_TOKEN,
        query: process.env.ACCOUNT_5_QUERY
    }
    // Tambahkan akun lainnya dengan format yang sama
];

async function sendTelegramNotification(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        console.log(`Notifikasi Telegram terkirim: ${message}`);
    } catch (error) {
        console.error('Error mengirim notifikasi Telegram:', error.response ? error.response.data : error.message);
    }
}

async function login(account) {
    try {
        const response = await axios.post(TELEGRAM_MINI_APP_URL, { query: account.query });

        account.accessToken = response.data.token.access;
        account.refreshToken = response.data.token.refresh;

        console.log(`Login berhasil untuk ${account.name}`);
        await getBalanceAndCheckFarming(account);

        // Jalankan klaim farming langsung setelah login
        setTimeout(async () => {
            await claimFarming(account);
        }, 10000); // Menunggu 10 detik sebelum klaim farming

    } catch (error) {
        console.error(`Error selama login untuk ${account.name}:`, error.response ? error.response.data : error.message);
    }

    // Jadwalkan login ulang setiap 10 detik
    setTimeout(() => login(account), 10000);
}

async function getBalanceAndCheckFarming(account) {
    try {
        const response = await axios.get(USER_BALANCE_URL, {
            headers: { Authorization: `Bearer ${account.accessToken}` }
        });

        const data = response.data;
        const farming = data.farming || {};
        const endTime = farming.endTime ? new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'full',
            timeStyle: 'long',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(farming.endTime)) : 'N/A';

        console.log({
            availableBalance: data.availableBalance,
            playPasses: data.playPasses,
            timestamp: data.timestamp,
            farming: {
                startTime: farming.startTime,
                endTime: farming.endTime,
                earningsRate: farming.earningsRate,
                balance: farming.balance
            }
        });
        console.log(`End Time: ${endTime}`);

        const currentTime = new Date().getTime();
        if (farming.endTime && new Date(farming.endTime).getTime() < currentTime) {
            console.log(`Farming selesai tetapi belum diklaim untuk akun dengan query ${account.query}, menunggu 10 detik sebelum klaim...`);
            setTimeout(async () => {
                await claimFarming(account);
            }, 10000); // Menunggu 10 detik sebelum klaim
        } else if (farming.endTime) {
            scheduleJobForClaiming(account, new Date(farming.endTime).getTime());
        } else {
            console.log(`Data farming tidak tersedia untuk akun dengan query ${account.query}. Memulai farming baru...`);
            await startFarming(account);
        }
    } catch (error) {
        console.error(`Error mendapatkan saldo untuk akun dengan query ${account.query}:`, error.response ? error.response.data : error.message);
    }
}

async function startFarming(account) {
    try {
        const response = await axios.post(START_FARMING_URL, {}, {
            headers: { Authorization: `Bearer ${account.accessToken}` }
        });

        const farming = response.data;
        const endTime = new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'full',
            timeStyle: 'long',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(farming.endTime));

        console.log(`Farming dimulai untuk akun dengan query ${account.query}:`, {
            startTime: farming.startTime,
            endTime: farming.endTime,
            earningsRate: farming.earningsRate,
            balance: farming.balance
        });
        console.log(`End Time: ${endTime}`);

        await sendTelegramNotification(`Farming dimulai untuk ${account.name}: Start Time: ${farming.startTime}, End Time: ${endTime}`);
        scheduleJobForClaiming(account, new Date(farming.endTime).getTime());
    } catch (error) {
        console.error(`Error memulai farming untuk akun dengan query ${account.query}:`, error.response ? error.response.data : error.message);
    }
}

async function claimFarming(account) {
    try {
        const response = await axios.post(CLAIM_FARMING_URL, {}, {
            headers: { Authorization: `Bearer ${account.accessToken}` }
        });

        console.log(`Farming diklaim untuk akun dengan query ${account.query}:`, response.data);
        await sendTelegramNotification(`Farming diklaim untuk ${account.name}: ${JSON.stringify(response.data)}`);
        await startFarming(account);
    } catch (error) {
        console.error(`Error klaim farming untuk akun dengan query ${account.query}:`, error.response ? error.response.data : error.message);
    }
}

function scheduleJobForClaiming(account, endTime) {
    schedule.scheduleJob(new Date(endTime), async () => {
        console.log(`Waktu untuk klaim farming telah tiba untuk akun dengan query ${account.query}.`);
        await claimFarming(account);
    });
}

(async () => {
    for (const account of accounts) {
        await login(account);
    }
})();
