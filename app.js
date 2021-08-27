const createError = require('http-errors');
var express = require('express');
var Updater = require('./helpers/updateHelper');
var solanaWeb3 = require('@solana/web3.js')
var indexRouter = require('./routes/index');
var axios = require('axios')
var app = express();
var {base58_to_binary} = require('base58-js')
var BN = require('bn.js')
var serum = require('@project-serum/serum')
var fs = require('fs')
require('dotenv').config()

const {OPENSEARCH_URL} = process.env
app.use(express.json());
app.use(express.urlencoded({extended: false}));

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


// Poll cluster every 3 seconds for new blocks and transactions
var u = new Updater(3000);
// send to opensearch db every 60 seconds
var sender = new Updater(60000);
var singles = new Set()

sender.init();
u.init();
u.on('Event', async function () {
    var conn = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com")
    var slot = await conn.getSlot()
    var block = await conn.getBlock(slot)
    fs.readFile("./blocks_count", (err, data) => {
        var b = parseInt(data === undefined ? "0" : data.toString())
        fs.writeFile("./blocks_count", String(b + 1), () => {
        })
    })

    block.transactions.forEach(transaction => {
        transaction.transaction.message.accountKeys.forEach(account => {
            // filter transactions by serum dex program
            var programId = transaction.transaction.message.accountKeys[transaction.transaction.message.instructions[0].programIdIndex].toBase58()
            if (programId === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" && transaction.transaction.message.instructions.length === 1) {
                var instruction = transaction.transaction.message.instructions[0]
                if (transaction.transaction.message.accountKeys[instruction.programIdIndex].toBase58() === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" && base58_to_binary(instruction.data).length === 51 && (instruction.accounts.length === 13 || instruction.accounts.length === 12)) {
                    // keep transaction to send to opensearch
                    singles.add(transaction.transaction)

                }


            }
        })


    })
});

sender.on("Event", async () => {
    if (singles.size === 0) {
        console.log("No new transactions to index")
    }
    var clone = new Set(singles)
    singles.clear()
    // traverse each unique saved transaction and save to index after some more validation
    var bulk = ""
    clone.forEach(transaction => {
        var markets = serum.MARKETS.filter(market => !market.deprecated).map(market => market.address.toBase58())
        var marketId = transaction.message.accountKeys.map(key => key.toBase58()).filter(key => markets.findIndex(k => k === key) !== -1)
        if (marketId.length !== 1) return
        var data = base58_to_binary(transaction.message.instructions[0].data)
        var price = new BN(data.slice(4, 12))
        var post = `{"index": {"_index": "serum_buy"}}
        {"marketId": ${marketId[0]}, "price": ${price.toString(10)}}\n`
        bulk += post;
    })
    bulk += "\n\n"
    axios.post(
        OPENSEARCH_URL + "/serum_buy/_bulk",
        bulk,
        {headers: {"Content-Type": "application/json"}})
        .catch(console.error)
        .then(res => {
            fs.readFile("./transactions_count", (err, data) => {
                var b = parseInt(data === undefined ? "0" : data.toString())
                fs.writeFile("./transactions_count", String(b + clone.size), () => {
                })
            })
        })

})