var express = require('express');
var router = express.Router();
var fs = require('fs')
var axios = require('axios')
require('dotenv').config()
/* GET home page. */
const {OPENSEARCH_URL} = process.env
router.get('/', function (req, res, next) {
    var transactions = fs.readFileSync('transactions_count').toString()

    res.render('index')
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


module.exports = router;
