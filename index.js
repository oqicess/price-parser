const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const [url, region] = process.argv.slice(2);

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setViewport({ width: 1080, height: 1080 });
    await page.goto(url, { waitUntil: ['networkidle2'] });

    await page.waitForSelector(`span[class="Region_regionIcon__oZ0Rt"]`);

    await delay(3000);

    await page.locator('div[class="Region_region__6OUBn"]').click();
    const ulSelector = '.UiRegionListBase_listWrapper__Iqbd5 > ul';

    await page.evaluate(
        (ulSelector, targetText) => {
            const ulElement = document.querySelector(ulSelector);
            if (ulElement) {
                const liElements = ulElement.querySelectorAll('li.UiRegionListBase_item___ly_A');
                for (const li of liElements) {
                    if (li.textContent.trim() === targetText) {
                        li.click();
                        break;
                    }
                }
            }
            return null;
        },
        ulSelector,
        region
    );

    await delay(2000);

    try {
        await page.waitForSelector('div[class="PriceInfo_root__GX9Xp"]', { timeout: 2000 });
    } catch (error) {
        const rating = await page.$eval(`a[class="ActionsRow_stars__EKt42"]`, (e) => e.innerText);
        const reviewCount = (
            await page.$eval(`a[class="ActionsRow_reviews__AfSj_"]`, (e) => e.innerText)
        ).split(' ');

        fs.writeFileSync(
            'product.txt',
            `price=null\nrating=${rating}\nreviewCount=${reviewCount[0]}\n`,
            'utf8'
        );

        await scroll(page);

        await page.screenshot({
            path: 'screenshot.jpg',
            fullPage: true,
        });

        await browser.close();
        return;
    }

    const prices = await page.evaluate(() => {
        const extractPrice = (selector) => {
            const element = document.querySelector(selector, { timeout: 2000 });
            if (element) {
                const integerPart = element.childNodes[0].textContent.trim();
                const fractionalPart =
                    element.querySelector('.Price_fraction__lcfu_')?.textContent.trim() || '';
                const fullText = integerPart + fractionalPart;
                return fullText.replace(/[^0-9,]/g, '');
            }
            return null;
        };

        const oldPrice = extractPrice(
            '.PriceInfo_oldPrice__IW3mC .Price_price__QzA8L.Price_role_old__r1uT1'
        );
        const price = extractPrice(
            '.PriceInfo_root__GX9Xp .Price_price__QzA8L.Price_role_discount__l_tpE'
        );

        if (!oldPrice && !price) {
            const regularPrice = extractPrice(
                '.PriceInfo_root__GX9Xp .Price_price__QzA8L.Price_role_regular__X6X4D'
            );
            return {
                oldPrice: null,
                price: regularPrice,
            };
        }

        return {
            oldPrice,
            price,
        };
    });

    const rating = await page.$eval(`a[class="ActionsRow_stars__EKt42"]`, (e) => e.innerText);
    const reviewCount = (
        await page.$eval(`a[class="ActionsRow_reviews__AfSj_"]`, (e) => e.innerText)
    ).split(' ');

    let fileContent = `price=${prices.price || 'нет в наличии'}\n`;
    if (prices.oldPrice) {
        fileContent += `priceOld=${prices.oldPrice}\n`;
    }
    fileContent += `rating=${rating}\nreviewCount=${reviewCount[0]}\n`;

    fs.writeFileSync('product.txt', fileContent, 'utf8');

    // Прокрутка до конца страницы для полного скриншота, если не нужно - удалить
    await scroll(page);

    await page.screenshot({
        path: 'screenshot.jpg',
        fullPage: true,
    });

    await browser.close();
})();

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

// Прокрутка до конца страницы для полного скриншота, если не нужно - удалить
function scroll(page) {
    return page.evaluate(async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        while (true) {
            window.scrollBy(0, window.innerHeight);
            await delay(100);
            if (window.innerHeight + window.scrollY >= document.body.scrollHeight) {
                break;
            }
        }
        await delay(1000);
    });
}
