const sleep = async (ms) => new Promise(r => setTimeout(r, ms));

function parseDocFromRedis(docStr) {
    try {
        let doc = JSON.parse(docStr);
        doc.createdAt = new Date(doc.createdAt);
        return doc;
    } catch(err) {
        console.log("error parsing doc from redis", err)
    }
}

module.exports = {
    sleep,
    parseDocFromRedis
}
