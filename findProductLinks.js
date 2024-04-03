const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pgp = require("pg-promise")();
const db = pgp("postgres://mehdi:mehdi@78.46.124.237:5433/mehdi");  //mehdi
const { scrollToEnd } = require('./utils')
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ================================================================
async function insertUrl(url, brand) {
    const existsQuery = `
        SELECT * FROM unvisited u 
        where "url"=$1
    `

    const insertQuery = `
        INSERT INTO unvisited ("url", "brand")
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

async function removeUrl() {
     const existsQuery = `
        SELECT * FROM main_links 
        limit 1
    `
     const deleteQuery = `
          DELETE FROM main_links 
          WHERE id=$1
     `
     try {
          const urlRow = await db.oneOrNone(existsQuery);
          if (urlRow) {
               await db.query(deleteQuery, [urlRow.id])
          }
          return urlRow;
     } catch (error) {
          console.log("we have no url", error);
     }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// ============================================ getBrowser
const getBrowser = async (proxyServer, headless = true, withProxy = true) => {
    try {
        const args = (withProxy) => {
            if (withProxy == true) {
                console.log("terue");
                return ["--no-sandbox", "--disable-setuid-sandbox", `--proxy-server=${proxyServer}`]
            }
            else {
                return ["--no-sandbox", "--disable-setuid-sandbox"]
            }
        }
        // Lunch Browser
        const browser = await puppeteer.launch({
            headless: headless, // Set to true for headless mode, false for non-headless
            executablePath:
                process.env.NODE_ENV === "production"
                        ? process.env.PUPPETEER_EXECUTABLE_PATH
                    : puppeteer.executablePath(),
            args: args(withProxy),
            protocolTimeout: 6000000
        });     

        return browser;
    }
    catch (error) {
        console.log("Error in getBrowserWithProxy function", error);
    }
}

// ============================================ login
// async function login(page, url ,userOrPhone, pass) {
//      try {
//           await page.goto(url, { timeout: 360000 });

//           let u = "09376993135";
//           let p = "hd6730mrm";
//           // sleep 5 second
//           console.log("-------sleep 5 second");
//           await delay(5000);

//           // load cheerio
//           const html = await page.content();
//           const $ = cheerio.load(html);

//           const usernameInputElem = await page.$$('input#username');
//           await page.evaluate((e) => e.value = "09376993135" ,usernameInputElem[0]);
//           await delay(3000);

//           const continueElem = await page.$$('.register_page__inner > button[type=submit]');
//           await continueElem[0].click();
//           await delay(3000);

//           const passwordInputElem = await page.$$('input#myPassword');
//           await passwordInputElem[0].type("hd6730mrm");
//           // await page.evaluate((e) => e.value = "hd6730mrm" ,passwordInputElem[0]);
//           await delay(3000);

//           const enterElem = await page.$$('.register_page__inner > button[type=submit]');
//           await enterElem[0].click();
//           await delay(3000);
          
//      } catch (error) {
//           console.log("Error In login function", error);
//      }
// }


// ============================================ findAllProductsLinks
async function findAllProductsLinks(page, url, brandName) {
    try {
        console.log("\n========================================", brandName);
        await page.goto(url, { timeout: 1800000 });

        // sleep 5 second when switching between pages
        console.log("-------sleep 3 second");
        await delay(3000);

        let nextPageBtn;
        do {
        // Scroll To End
        await scrollToEnd(page);
        await delay(2000);

        // Load Cheerio
        const html = await page.content();
        const $ = cheerio.load(html);

            
        // Getting All Products Urls In This Page
        const productsUrls = $('div.cards > div > a')
                .map((i, e) => 'https://torob.com' + $(e).attr('href'))
                .get()
            
        const uniqueProductsUrls = Array.from(new Set(productsUrls));
            

            // Add Urls To Unvisited
        console.log("Importing urls to unvisited ...");
        for (let j = 0; j < uniqueProductsUrls.length; j++){
            try {
                const url = uniqueProductsUrls[j];
                await insertUrl(url, brandName);
                await delay(500);
            } catch (error) {
                console.log("Error in findAllProductsLinks for loop:", error.message);
            }
        }

            
        // nextPageBtn = await page.$$('#pagination_bottom > ul > li.pagination_next > a');
        nextPageBtn = await page.$$('notFound');
        if(nextPageBtn.length){
                let btn = nextPageBtn[0];
                await btn.click();
        }
        await delay(3000);
        }
        while(nextPageBtn.length)
    } catch (error) {
        console.log("Error In findAllProductsLinks function", error);
    }
}


// ============================================ Main
async function main() {
    return new Promise(async(res, rej) => {
        try {
            // Lunch Browser
            const proxy = 'ss://YWVzLTI1Ni1nY206d0dVaGt6WGpjRA==@38.54.13.15:31214#main'
            const browser = await getBrowser(proxy, true, false);
    
            const page = await browser.newPage();
            await page.setViewport({
                width: 1920,
                height: 1080,
            });
        
            const urlRow = await removeUrl();
            if (urlRow) {
                await findAllProductsLinks(page, urlRow.url, urlRow.brand);
            }
            
            // Close page and browser
            console.log("End");
            await page.close();
                await browser.close();
                res("Tamam")
        } catch (error) {
            console.log("Error In main Function", error);
            rej("Error")
        }

    })
}

async function w() {
    while (true) {
        await main();
    
        console.log("================ sleep in while");
        await delay(5000)
        console.log("================ start while");
    
    }
}

w();