const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pgp = require("pg-promise")();
const db = pgp("postgres://mehdi:mehdi@78.46.124.237:5433/mehdi");  //mehdi
const { scrollToEnd } = require('./utils')
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function insertUrl(url, brand) {
    const existsQuery = `
        SELECT * FROM main_links u 
        where "url"=$1
    `

    const insertQuery = `
        INSERT INTO main_links ("url", "brand")
        VALUES ($1, $2)
        RETURNING *;
    `
    const urlInDb = await db.oneOrNone(existsQuery, [url])
    if (!urlInDb) {
        try {
            const result = await db.query(insertQuery, [url, brand]);
            return result;
        } catch (error) {
            console.log(`Error in insert url function : ${url}\nError:`, error.message);
        }
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// ============================================ findAllMainLinks
async function findMainLinks(page, initialUrl) {
    const allBrandsAndUrls = []
     try {
        const url = initialUrl;
        await page.goto(url, { timeout: 360000 });


        // sleep 3 second 
        console.log("-------sleep 5 second");
        await delay(3000);

        // Show More Brands
        const showAllBrandsElem = await page.$$('.more-btn-title');
        if (showAllBrandsElem?.length) {
            await showAllBrandsElem[0].click();
        }

        // sleep 2 second 
        await delay(2000);
         
        // load cheerio
        const html = await page.content();
        const $ = cheerio.load(html);
         
        // Getting All Brands And Urls In This Page
        const urlsAndBrands = $('.filter-brand-container > a').map((i, e) => {
            const url = 'https://torob.com' + $(e).attr('href');
            const brandName = $(e).find('>div:first-child').text()?.trim();
            return [[url, brandName]];;
        }).get()

          // Push This Page Products Urls To allProductsLinks
        allBrandsAndUrls.push(...urlsAndBrands);
        const set = new Set(allBrandsAndUrls.map(JSON.stringify));
        const uniqueArray = Array.from(set).map(JSON.parse);
        
         //  import main link to main_links
         for (let j = 0; j < uniqueArray.length; j++){
             const [url, brandName] = uniqueArray[j];
             await insertUrl(url, brandName);
             await delay(300)
         }
         
     } catch (error) {
          console.log("Error In findAllMainLinks function", error.message);
    }
    
    const set = new Set(allBrandsAndUrls.map(JSON.stringify));
    const uniqueArray = Array.from(set).map(JSON.parse);
    return uniqueArray;
}


// ============================================ Main
async function main() {
    try {
        const INITIAL_PAGE_URL = [
            'https://torob.com/browse/1627/%D8%B3%DB%8C%D9%86%DA%A9-%D8%B8%D8%B1%D9%81%D8%B4%D9%88%DB%8C%DB%8C/',
            'https://torob.com/browse/1630/%D8%B4%DB%8C%D8%B1%D8%A7%D9%84%D8%A7%D8%AA-%D8%A7%D8%B4%D9%BE%D8%B2%D8%AE%D8%A7%D9%86%D9%87/',
            'https://torob.com/browse/2420/%D8%B4%DB%8C%D8%B1%D8%A7%D9%84%D8%A7%D8%AA-%D8%B3%D8%B1%D9%88%DB%8C%D8%B3-%D8%A8%D9%87%D8%AF%D8%A7%D8%B4%D8%AA%DB%8C-%D9%88-%D8%AD%D9%85%D8%A7%D9%85/',
            'https://torob.com/browse/1638/%D8%B3%D8%AA-%DA%A9%D8%A7%D9%85%D9%84-%D8%B4%DB%8C%D8%B1%D8%A7%D9%84%D8%A7%D8%AA/',
            'https://torob.com/browse/1639/%D8%B4%DB%8C%D8%B1-%D9%BE%DB%8C%D8%B3%D9%88%D8%A7%D8%B1/',
            'https://torob.com/browse/1640/%D9%84%D9%88%D8%A7%D8%B2%D9%85-%D8%AC%D8%A7%D9%86%D8%A8%DB%8C-%D8%B4%DB%8C%D8%B1%D8%A7%D9%84%D8%A7%D8%AA/',
            'https://torob.com/browse/1633/%DA%A9%D9%81%D8%B4%D9%88%D8%B1/',
        ];

        
        // Lunch Browser
        const browser = await puppeteer.launch({
            headless: false, // Set to true for headless mode, false for non-headless
            executablePath:
                process.env.NODE_ENV === "production"
                        ? process.env.PUPPETEER_EXECUTABLE_PATH
                        : puppeteer.executablePath(),
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            protocolTimeout: 6000000
        });

        const page = await browser.newPage();
        await page.setViewport({
            width: 1920,
            height: 1080,
        });
        
        
        for (const url of INITIAL_PAGE_URL) {
            await findMainLinks(page, url)
            await delay(3000);
        }
        

        
    // Close page and browser
    console.log("End");
    await page.close();
    await browser.close();
    } catch (error) {
        console.log("Error In main Function", error);
    }
}

main();
