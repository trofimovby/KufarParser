require('dotenv').config();
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

// Получаем токен и ID пользователя из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_USER_ID = process.env.TELEGRAM_USER_ID;
const PAGE_URL = process.env.PAGE_URL;

// Функция для отправки сообщения в Telegram
async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const params = {
        chat_id: TELEGRAM_USER_ID,
        text: message,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });
        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Ошибка при отправке сообщения: ${data.description}`);
        }
        console.log(`Сообщение успешно отправлено в Telegram: ${message}`);
    } catch (error) {
        console.error(`Ошибка при отправке сообщения в Telegram: ${error.message}`);
    }
}

// Отправляем тестовое сообщение при запуске скрипта
sendTelegramMessage('Скрипт успешно запущен!');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    console.log(`[${new Date().toISOString()}] Скрипт запущен, проверка будет выполняться каждые 10 секунд.`);

    let previousAds = [];

    async function checkForUpdates() {
        try {
            console.log(`[${new Date().toISOString()}] Запуск проверки обновлений...`);
            await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
            const newAds = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[class^="styles_wrapper_"]')).map(wrapper => {
                    const titleElement = wrapper.querySelector('[class^="styles_title_"]');
                    const priceElement = wrapper.querySelector('[class^="styles_price_"]');
                    const linkElement = wrapper.closest('a');
                    return {
                        title: titleElement ? titleElement.innerText.trim() : null,
                        price: priceElement ? priceElement.innerText.trim() : null,
                        link: linkElement ? linkElement.href : null,
                    };
                }).filter(ad => ad.title && ad.link && ad.price);
            });

            // Найти новые объявления
            const newTitles = newAds.map(ad => ad.title);
            const oldTitles = previousAds.map(ad => ad.title);
            const newEntries = newAds.filter(ad => !oldTitles.includes(ad.title));

            if (newEntries.length > 0) {
                console.log(`[${new Date().toISOString()}] Объявления обновлены! Новые объявления:`);
                for (const ad of newEntries) {
                    const message = `Новое объявление:\n- ${ad.title} (${ad.price}): ${ad.link}`;
                    console.log(message);
                    await sendTelegramMessage(message);
                }
                previousAds = newAds;
            } else {
                console.log(`[${new Date().toISOString()}] Объявления не изменились.`);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Произошла ошибка при проверке обновлений: ${error.message}`);
        }
    }

    await checkForUpdates();
    setInterval(checkForUpdates, 10 * 1000); // проверка каждые 10 секунд
})();
