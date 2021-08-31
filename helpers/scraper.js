const fs = require('fs')
const {base58_to_binary} = require( "base58-js");
const solanaWeb3 = require("@solana/web3.js");
require('dotenv').config()
const singles = new Set()
const processed = new Set()
const {CLUSTER_URL= "https://api.mainnet-beta.solana.com"} = process.env


async function Scraper() {
    try {
        var conn = new solanaWeb3.Connection(CLUSTER_URL)

        var slot = await conn.getSlot()
        var block = await conn.getBlock(slot)

        block.transactions.forEach(transaction => {
            transaction.transaction.message.accountKeys.forEach(account => {
                // filter transactions by serum dex program
                var programId = transaction.transaction.message.accountKeys[transaction.transaction.message.instructions[0].programIdIndex].toBase58()
                if (programId === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" && transaction.transaction.message.instructions.length === 1) {
                    var instruction = transaction.transaction.message.instructions[0]
                    // look for `Serum New Order` instructions with the number of accounts the instructions requires
                    // first check if the tx has not already been processed
                    // after that check if the program id is the same as serum dex's program id
                    // then check if the size of instruction is 51 which is length of new order ix data with 5 bytes of padded blob
                    // then check the number of accounts the instruction utilizes serum new order ixs requires 13 or 12 accounts
                    if (!processed.has(transaction.transaction)
                        && transaction.transaction.message.accountKeys[instruction.programIdIndex].toBase58() === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
                        && base58_to_binary(instruction.data).length === 51
                        && (instruction.accounts.length === 13 || instruction.accounts.length === 12)) {
                        // keep new order ix in a set so it is not repeated
                        singles.add(transaction.transaction)
                        // save the transaction so it is not processed again
                        processed.add(transaction.transaction)
                    }


                }
            })

            // for the sake of this task processed txs are stored in memory so we need to free memory at some point
            // this can also be moved to a secondary storage to save all history of processed txs
            if (processed.size > 5000 ) processed.clear()

        })

    } catch (e) {
        console.error("Error on scraper:",e)
    }



}
const clearSingles = function() {
    singles.clear()
}

module.exports = {Scraper, clearSingles, singles}