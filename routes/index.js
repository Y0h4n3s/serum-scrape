var express = require('express');
var router = express.Router();
var fs = require('fs')
var axios = require('axios')
require('dotenv').config()
/* GET home page. */
const {OPENSEARCH_URL} = process.env
router.get('/', function (req, res, next) {
    var transactions = fs.readFileSync('transactions_count').toString()

    res.send(lazy_template)
});

router.get('/index', async (req, res) => {
    await axios
        .get(OPENSEARCH_URL + "/serum_buy/_search")
        .catch(res.error)
        .then(r => res.send(r.data))
})

router.get('/search', async (req, res) => {
    let r = await axios
        .get(OPENSEARCH_URL + "/serum_buy/_search?q=" + req.query.q)
        .catch(res.error)
        .then(r => res.send(r.data))
})

router.get("/blocks", (req, res) => {
    var blocks = fs.readFileSync('blocks_count').toString()
    res.send(blocks)
})

router.get("/transactions", (req, res) => {
    var transactions = fs.readFileSync('transactions_count').toString()
    res.send(transactions)
})
module.exports = router;

const lazy_template = "<html lang=\"en\">\n" +
    "<head>\n" +
    "    <meta charset=\"UTF-8\">\n" +
    "    <title>Title</title>\n" +
    "</head>\n" +
    "<body>\n" +
    "    \n" +
    `<p>Blocks: <span id="blocks">0</span></p>
    <p>Transaction: <span id="transactions">0</span></p>
    <p>Index: <a href="/index">Here...</a> </p>
    <p>Query: <a href="/search?q=<query>">Here...</a> </p>
` +
    `<script> var e = async () => {
    var sleep = async (time) => await new Promise((resolve) => setTimeout(resolve, time));

console.log("executing")
               while (true) {
                   try {
                       await sleep(3000)
                       document.getElementById("blocks").innerText = await fetch(document.location.href + "blocks").then(result => result.json())
                       document.getElementById("transactions").innerText = await fetch(document.location.href + "transactions").then(result => result.json())
                   } catch (e) {
                       console.error(e)
                   }
               }
               }
               e()
</script>` +
    "</body>\n" +
    "</html>"