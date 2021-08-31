const createError = require('http-errors');
const express = require('express');
const Updater = require('./helpers/updateHelper');
const solanaWeb3 = require('@solana/web3.js');
const indexRouter = require('./routes/index');
const axios = require('axios');
const app = express();
const {base58_to_binary} = require('base58-js');
const BN = require('bn.js');
const serum = require('@project-serum/serum');
const fs = require('fs');
const lo = require('buffer-layout');
const {union, u32, struct, u16, blob, seq} = require("buffer-layout");
const {sideLayout, u64, selfTradeBehaviorLayout, orderTypeLayout, accountFlagsLayout, publicKeyLayout, u128} = require("@project-serum/serum/lib/layout");
const tokenList = require('@solana/spl-token-registry')
const DbSender = require("./helpers/dbIndexer");
const Scraper = require("./helpers/scraper");
require('dotenv').config()

const {CLUSTER_URL= "https://api.mainnet-beta.solana.com"} = process.env


app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.set('view engine', 'jade')
app.use('/', indexRouter);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});


module.exports = app;

let marketsMap = {}


// 3 modules
// 1. scraper: parses blocks on solana chain and filters out serum program transactions and saves them without replicating
// 2. sender: takes the saved txs and stores them in an openbase cluster hosted @ https://bonsai.io. after adding some more info like price, tokenName, price...
// 3. serumMarketsMapper: run initially and every 6 hours, loads all of serums markets and their mints beforehand.

// Poll cluster every 2 seconds for new blocks and transactions
var scraper = new Updater(2000, "scrape", {});
scraper.init();

// send to opensearch db every 60 seconds
var sender = new Updater(3000, "send", {scraper: Scraper, marketsMap: marketsMap});
sender.init();

// update serum market mint addresses every 6 hrs
var serumMarketsMapper = new Updater(  6 * 60 * 60 * 1000, "update")
serumMarketsMapper.init();

serumMarketsMapper.on("update",async () => {
    await setupMarkets();
})
serumMarketsMapper.emit("update")




// populate marketsMap with market objects for later use
// since this is mostly static and not likely to change frequently
async function setupMarkets() {
    // remove listeners since they depend on marketsMap
    sender.removeListener('send', DbSender)
    scraper.removeListener('scrape', Scraper.Scraper)
    const markets = serum.MARKETS.filter(market => !market.deprecated).map(market => market.address.toBase58());

    const conn = new solanaWeb3.Connection(CLUSTER_URL);
    let retries = 5
    while (true) {
        try {
            const tempMap = {};
            for (const market of markets) {
                tempMap[market] = await serum.Market.load(
                    conn,
                    new solanaWeb3.PublicKey(market),
                    {},
                    new solanaWeb3.PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")
                )
                console.log("done: ", (((markets.indexOf(market) + 1) / markets.length) * 100), "%")
                // sleep for some milli secs to avoid `429 Too Many Requests` responses
                await sleep(500)
            }
            retries--
            if (Object.keys(tempMap).length === markets.length || retries < 0) {
                marketsMap = tempMap
                break
            }
            console.log("Incomplete, Retrying...")
        }catch (e) {
            console.error("Error on setting up:", e)

        }
    }

    sender.setArgs({scraper: Scraper, marketsMap: marketsMap})
    // reactivate listeners
    sender.on("send", DbSender)
    scraper.on('scrape', Scraper.Scraper)

}

const sleep = async (time) => {
    return new Promise(resolve => setTimeout(resolve, time))
}