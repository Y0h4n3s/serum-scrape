const tokenList = require("@solana/spl-token-registry");
const serum = require("@project-serum/serum");
const {base58_to_binary} = require("base58-js");
const lo = require("buffer-layout");
const {sideLayout, u64, selfTradeBehaviorLayout, orderTypeLayout} = require("@project-serum/serum/lib/layout");
const {u16} = require("buffer-layout");
const solanaWeb3 = require("@solana/web3.js");
const {json} = require("express");
const axios = require("axios");
require('dotenv').config()
const {CLUSTER_URL= "https://api.mainnet-beta.solana.com", OPENSEARCH_URL} = process.env

async function DbIndexer({scraper, marketsMap}) {
    console.log(scraper)
        const  singles = scraper.singles
        let clone = new Set(singles)
        scraper.clearSingles();
        if (clone.size === 0) {
            console.log("No new transactions to index")
            return
        }
        const conn = new solanaWeb3.Connection(CLUSTER_URL)

        try {
            // prepare a bulk request with each transaction to send to opensearch
            let bulk = ""
            // traverse each unique saved transaction and save to index after some more validation

            // get token listing from solana's spl-token registry
            const tokens = await new tokenList.TokenListProvider().resolve();
            const mainnetTokens = tokens.filterByClusterSlug("mainnet-beta").getList()
            for (const transaction of clone) {
                var markets = serum.MARKETS.filter(market => !market.deprecated).map(market => market.address.toBase58())
                var marketId = transaction.message.accountKeys.map(key => key.toBase58()).filter(key => markets.findIndex(k => k === key) !== -1)
                // some serum consume event instructions could have 13 or 12 account keys so they are filtered here
                if (marketId.length !== 1) continue;
                var dat = base58_to_binary(transaction.message.instructions[0].data)

                // data format for new order ix v3
                // see here https://github.com/project-serum/serum-ts/blob/master/packages/serum/src/instructions.js#L74
                var lay = lo.struct([
                    sideLayout('side'),
                    u64('limitPrice'),
                    u64('maxBaseQuantity'),
                    u64('maxQuoteQuantity'),
                    selfTradeBehaviorLayout('selfTradeBehavior'),
                    orderTypeLayout('orderType'),
                    u64('clientId'),
                    u16('limit'),
                ]);
                //remove padding blob and decode order instruction
                let d = lay.decode(Buffer.from(dat.slice(5)))

                // since only buy transactions are required skip if this is a sell instruction
                if (d.side === "sell") continue;

                // this has already been set on first run and is updated every 6 hrs
                let market = marketsMap[marketId]

                let currentToken = mainnetTokens.filter(tkn => tkn.address === market.baseMintAddress.toBase58())[0]
                let post = '{ "index": {"_index": "serum_buy" }}\n' +
                    '{ "marketId": "' + marketId[0] + '", "limitPrice": "' + market.priceLotsToNumber(d.limitPrice) + '", "maxBaseQuantity": "' + market.baseSizeLotsToNumber(d.maxBaseQuantity) + '", "maxQuoteQuantity": "' + market.quoteSizeLotsToNumber(d.maxQuoteQuantity) + '", "signature": "' + transaction.signatures[0] + '", "decimals": "' + currentToken.decimals + '", "tokenSymbol": "' + currentToken.symbol + '"}\n'
                bulk += post;
            }

            if (bulk === "")  return
            bulk += "\n"
            console.log(bulk)
            console.log("not here")

            // index the transactions
            axios.post(
                OPENSEARCH_URL + "/_bulk",
                bulk,
                {headers: {"Content-Type": "application/json"}})
                .catch(console.error)
                .then(res => {

                })
        }catch (e) {
            console.error("Error on sender:",e)
        }
}

module.exports = DbIndexer